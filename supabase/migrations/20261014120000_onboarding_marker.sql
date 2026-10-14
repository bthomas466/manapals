-- =========================================================
-- #34 onboarding wizard: per-profile "finished onboarding" marker.
-- NULL = the user still has to go through /welcome.
-- =========================================================

-- Backfill trick: adding the column with a non-volatile default (now() is
-- STABLE) is a catalog-only change on PG11+; every existing row reads the
-- migration's timestamp without a table rewrite and without firing the
-- profiles_set_updated_at trigger. Dropping the default afterwards leaves
-- existing rows marked and makes new rows (handle_new_user, ensureProfile's
-- insert) default to NULL.
alter table public.profiles
  add column onboarded_at timestamptz default now();

alter table public.profiles
  alter column onboarded_at drop default;

comment on column public.profiles.onboarded_at is
  'When the user finished (or skipped) the onboarding wizard. NULL = not yet onboarded; gated to /welcome.';

-- Guard: every pre-existing profile must be marked (AC-4).
do $$
begin
  if exists (select 1 from public.profiles where onboarded_at is null) then
    raise exception 'onboarded_at backfill incomplete';
  end if;
end;
$$;

-- RLS: no new policies. profiles_update_own (owner-only USING/WITH CHECK)
-- already governs writes to this column; profiles_select_authenticated
-- governs reads. No index: the only lookup is by primary key (user_id).
