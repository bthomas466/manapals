-- =========================================================
-- wishlist_items: cards a user wants, for the trade match engine
-- =========================================================
create table public.wishlist_items (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  card_id     uuid not null references public.cards(scryfall_id),
  oracle_id   uuid,
  match_mode  text not null default 'specific' check (match_mode in ('specific', 'any_printing')),
  created_at  timestamptz not null default now(),
  constraint wishlist_items_any_printing_needs_oracle
    check (match_mode = 'specific' or oracle_id is not null)
);

-- one "specific printing" wish per card per user
create unique index wishlist_items_user_card_specific_idx
  on public.wishlist_items (user_id, card_id) where match_mode = 'specific';

-- one "any printing" wish per oracle card per user
create unique index wishlist_items_user_oracle_any_idx
  on public.wishlist_items (user_id, oracle_id) where match_mode = 'any_printing';

create index wishlist_items_user_id_idx on public.wishlist_items (user_id);
create index wishlist_items_oracle_id_idx on public.wishlist_items (oracle_id) where oracle_id is not null;

alter table public.wishlist_items enable row level security;

-- Friends-only visibility, independent of profiles.collection_visibility
-- (PRD §4.7 only ever says "visible to friends" for the wishlist).
create policy "wishlist_items_select_own"
  on public.wishlist_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "wishlist_items_select_friends"
  on public.wishlist_items for select
  to authenticated
  using (private.are_friends((select auth.uid()), wishlist_items.user_id));

create policy "wishlist_items_insert_own"
  on public.wishlist_items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "wishlist_items_delete_own"
  on public.wishlist_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);
