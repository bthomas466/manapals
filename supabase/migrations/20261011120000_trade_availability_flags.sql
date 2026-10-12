-- =========================================================
-- Trade availability flags (issue #6, PRD US-11/US-12)
-- null = Unmarked, 'available' = opt-in offer, 'not_for_trade' = excluded.
-- Rides on existing collection_items RLS: readable by owner/friends/public
-- per collection_visibility, writable only by the owner (update_own).
-- =========================================================

-- Fail fast instead of queueing behind a long import transaction.
set local lock_timeout = '5s';

-- Nullable, no default: metadata-only change, no table rewrite.
-- Every existing row becomes Unmarked = today's behaviour.
alter table public.collection_items
  add column if not exists trade_status text;

-- The check is validated by a scan; all existing values are null so it is
-- cheap, but split NOT VALID / VALIDATE so the intent is explicit.
alter table public.collection_items
  add constraint collection_items_trade_status_check
  check (trade_status in ('available', 'not_for_trade')) not valid;

alter table public.collection_items
  validate constraint collection_items_trade_status_check;

comment on column public.collection_items.trade_status is
  'Trade availability: null = unmarked, available, not_for_trade. Carried over by replace_collection_items on (card_id, finish, binder_name).';

-- =========================================================
-- replace_collection_items: same signature and semantics, but trade flags
-- survive re-import for rows whose (card_id, finish, binder_name) is still
-- present. Flags are captured BEFORE the delete in a separate statement
-- (not a data-modifying CTE) so the insert never races the delete.
-- p_items cannot set trade_status: the recordset definition omits it.
-- =========================================================
create or replace function public.replace_collection_items(p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_flags   jsonb;
begin
  select coalesce(
           jsonb_agg(jsonb_build_object(
             'card_id', ci.card_id,
             'finish', ci.finish,
             'binder_name', ci.binder_name,
             'trade_status', ci.trade_status)),
           '[]'::jsonb)
    into v_flags
  from public.collection_items ci
  where ci.user_id = v_user_id
    and ci.trade_status is not null;

  delete from public.collection_items
  where user_id = v_user_id;

  insert into public.collection_items
    (user_id, card_id, quantity, finish, condition, language, binder_name, manabox_id, trade_status)
  select
    v_user_id, x.card_id, x.quantity, x.finish, x.condition, x.language, x.binder_name, x.manabox_id,
    f.trade_status
  from jsonb_to_recordset(p_items) as x(
    card_id     uuid,
    quantity    integer,
    finish      text,
    condition   text,
    language    text,
    binder_name text,
    manabox_id  text
  )
  left join jsonb_to_recordset(v_flags) as f(
    card_id      uuid,
    finish       text,
    binder_name  text,
    trade_status text
  )
    on  f.card_id = x.card_id
    and f.finish = x.finish
    and f.binder_name = x.binder_name;
end;
$$;

-- create or replace keeps existing grants; restated for clarity/idempotency.
revoke all on function public.replace_collection_items(jsonb) from public;
grant execute on function public.replace_collection_items(jsonb) to authenticated;
