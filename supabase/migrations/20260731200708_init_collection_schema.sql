-- =========================================================
-- Trigger helper: keep updated_at current
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- cards: shared Scryfall cache (identical across all users)
-- =========================================================
create table public.cards (
  scryfall_id      uuid primary key,
  oracle_id        uuid,
  name             text not null,
  set_code         text not null,
  set_name         text not null,
  collector_number text not null,
  rarity           text not null check (rarity in ('common','uncommon','rare','mythic','special','bonus')),
  mana_cost        text,
  cmc              numeric(4,1),
  type_line        text not null,
  colors           text[] not null default '{}',
  color_identity   text[] not null default '{}',
  image_small      text,
  image_normal     text,
  price_usd        numeric(10,2),
  price_usd_foil   numeric(10,2),
  scryfall_uri     text,
  raw_data         jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);

alter table public.cards enable row level security;

create policy "cards_select_authenticated"
  on public.cards for select
  to authenticated
  using (true);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- =========================================================
-- collection_items: per-user quantity/condition/binder data
-- =========================================================
create table public.collection_items (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  card_id      uuid not null references public.cards(scryfall_id),
  quantity     integer not null default 1 check (quantity > 0),
  finish       text not null default 'nonfoil' check (finish in ('nonfoil','foil','etched')),
  condition    text not null default 'near_mint'
               check (condition in ('mint','near_mint','lightly_played','moderately_played','heavily_played','damaged')),
  language     text not null default 'en',
  binder_name  text not null default '',
  manabox_id   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, card_id, finish, binder_name)
);

create index collection_items_user_id_idx on public.collection_items (user_id);
create index collection_items_card_id_idx on public.collection_items (card_id);

alter table public.collection_items enable row level security;

create policy "collection_items_select_own"
  on public.collection_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "collection_items_insert_own"
  on public.collection_items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "collection_items_update_own"
  on public.collection_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "collection_items_delete_own"
  on public.collection_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create trigger collection_items_set_updated_at
  before update on public.collection_items
  for each row execute function public.set_updated_at();

-- =========================================================
-- Atomic "replace whole collection" RPC (short transaction;
-- all Scryfall enrichment happens before this is called)
-- =========================================================
create or replace function public.replace_collection_items(p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.collection_items
  where user_id = (select auth.uid());

  insert into public.collection_items
    (user_id, card_id, quantity, finish, condition, language, binder_name, manabox_id)
  select
    (select auth.uid()), x.card_id, x.quantity, x.finish, x.condition, x.language, x.binder_name, x.manabox_id
  from jsonb_to_recordset(p_items) as x(
    card_id     uuid,
    quantity    integer,
    finish      text,
    condition   text,
    language    text,
    binder_name text,
    manabox_id  text
  );
end;
$$;

revoke all on function public.replace_collection_items(jsonb) from public;
grant execute on function public.replace_collection_items(jsonb) to authenticated;
