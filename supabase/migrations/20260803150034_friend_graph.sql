-- =========================================================
-- profiles: public identity for each user (username, display name, avatar)
-- =========================================================
create table public.profiles (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  username              text not null unique,
  display_name          text not null,
  avatar_url            text,
  collection_visibility text not null default 'friends'
                        check (collection_visibility in ('friends','public')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint profiles_username_format
    check (username = lower(username) and username ~ '^[a-z0-9_]{3,20}$')
);

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =========================================================
-- handle_new_user: provision a profile row when someone signs up
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  candidate     text;
  attempt       int := 0;
begin
  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  base_username := left(nullif(base_username, ''), 20);
  if base_username is null or length(base_username) < 3 then
    base_username := 'player';
  end if;

  candidate := base_username;
  loop
    begin
      insert into public.profiles (user_id, username, display_name, avatar_url)
      values (
        new.id,
        candidate,
        coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data ->> 'avatar_url'
      );
      exit;
    exception when unique_violation then
      attempt := attempt + 1;
      candidate := left(base_username, 20 - length(attempt::text) - 1) || '_' || floor(random() * (10 ^ attempt::int))::text;
      if attempt > 10 then
        raise exception 'could not generate a unique username for %', new.id;
      end if;
    end;
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- friendships: mutual connection graph
-- =========================================================
create table public.friendships (
  id            bigint generated always as identity primary key,
  requester_id  uuid not null references auth.users(id) on delete cascade,
  addressee_id  uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','accepted')),
  user_low      uuid generated always as (least(requester_id, addressee_id)) stored,
  user_high     uuid generated always as (greatest(requester_id, addressee_id)) stored,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint friendships_no_self_friend check (requester_id <> addressee_id),
  constraint friendships_unique_pair unique (user_low, user_high)
);

create index friendships_requester_id_idx on public.friendships (requester_id);
create index friendships_addressee_id_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;

create policy "friendships_select_participant"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "friendships_insert_as_requester"
  on public.friendships for insert
  to authenticated
  with check ((select auth.uid()) = requester_id);

create policy "friendships_update_as_addressee"
  on public.friendships for update
  to authenticated
  using ((select auth.uid()) = addressee_id)
  with check ((select auth.uid()) = addressee_id);

create policy "friendships_delete_participant"
  on public.friendships for delete
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- =========================================================
-- private.are_friends: RLS helper, bypasses RLS on friendships/profiles
-- =========================================================
create schema if not exists private;

create or replace function private.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and f.user_low = least(a, b)
      and f.user_high = greatest(a, b)
  );
$$;

revoke all on function private.are_friends(uuid, uuid) from public, anon;
grant execute on function private.are_friends(uuid, uuid) to authenticated;

-- =========================================================
-- collection_items: allow friends (or public profiles) to browse
-- =========================================================
create policy "collection_items_select_friends"
  on public.collection_items for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = collection_items.user_id
        and (
          p.collection_visibility = 'public'
          or private.are_friends((select auth.uid()), collection_items.user_id)
        )
    )
  );
