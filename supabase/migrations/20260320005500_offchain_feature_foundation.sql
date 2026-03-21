do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'creator_launch_status'
  ) then
    create type public.creator_launch_status as enum (
      'draft',
      'ready',
      'queued',
      'launching',
      'launched',
      'failed',
      'archived'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'collaboration_status'
  ) then
    create type public.collaboration_status as enum (
      'draft',
      'open',
      'active',
      'paused',
      'closed',
      'archived'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'collaboration_role'
  ) then
    create type public.collaboration_role as enum (
      'owner',
      'editor',
      'contributor',
      'viewer'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'collaboration_member_status'
  ) then
    create type public.collaboration_member_status as enum (
      'invited',
      'requested',
      'active',
      'declined',
      'left',
      'removed'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'community_status'
  ) then
    create type public.community_status as enum (
      'draft',
      'active',
      'archived'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'community_visibility'
  ) then
    create type public.community_visibility as enum (
      'public',
      'private'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'community_role'
  ) then
    create type public.community_role as enum (
      'owner',
      'moderator',
      'member'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'community_member_status'
  ) then
    create type public.community_member_status as enum (
      'invited',
      'requested',
      'active',
      'rejected',
      'left',
      'removed',
      'blocked'
    );
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  banner_url text,
  wallet_address text,
  lens_account_address text,
  zora_handle text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (
    username is null
    or username ~ '^[a-z0-9_]{3,32}$'
  )
);

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

create unique index if not exists profiles_wallet_address_unique_idx
  on public.profiles (lower(wallet_address))
  where wallet_address is not null;

create table if not exists public.creator_launches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  ticker text not null,
  name text not null,
  description text,
  cover_image_url text,
  cover_image_path text,
  metadata_uri text,
  coin_address text,
  chain_id integer not null default 8453,
  supply bigint not null default 10000000,
  post_destination text not null default 'every1_feed',
  status public.creator_launch_status not null default 'draft',
  launch_error text,
  launched_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint creator_launches_ticker_format check (
    ticker ~ '^[a-z0-9]{1,8}$'
  ),
  constraint creator_launches_name_length check (
    char_length(trim(name)) between 1 and 80
  ),
  constraint creator_launches_supply_positive check (supply > 0),
  constraint creator_launches_coin_address_format check (
    coin_address is null
    or coin_address ~ '^0x[a-fA-F0-9]{40}$'
  )
);

create unique index if not exists creator_launches_ticker_unique_idx
  on public.creator_launches (lower(ticker));

create unique index if not exists creator_launches_coin_address_unique_idx
  on public.creator_launches (lower(coin_address))
  where coin_address is not null;

create index if not exists creator_launches_created_by_idx
  on public.creator_launches (created_by, created_at desc);

create index if not exists creator_launches_status_idx
  on public.creator_launches (status, created_at desc);

create table if not exists public.creator_collaborations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  launch_id uuid references public.creator_launches (id) on delete set null,
  title text not null,
  description text,
  status public.collaboration_status not null default 'draft',
  max_members integer not null default 5,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint creator_collaborations_title_length check (
    char_length(trim(title)) between 1 and 120
  ),
  constraint creator_collaborations_max_members_positive check (
    max_members between 1 and 50
  )
);

create index if not exists creator_collaborations_owner_idx
  on public.creator_collaborations (owner_id, created_at desc);

create index if not exists creator_collaborations_status_idx
  on public.creator_collaborations (status, created_at desc);

create table if not exists public.creator_collaboration_members (
  collaboration_id uuid not null references public.creator_collaborations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.collaboration_role not null default 'contributor',
  status public.collaboration_member_status not null default 'invited',
  note text,
  joined_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (collaboration_id, profile_id)
);

create index if not exists creator_collaboration_members_profile_idx
  on public.creator_collaboration_members (profile_id, status, created_at desc);

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  avatar_url text,
  banner_url text,
  visibility public.community_visibility not null default 'public',
  status public.community_status not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint communities_slug_format check (
    slug ~ '^[a-z0-9-]{3,48}$'
  ),
  constraint communities_name_length check (
    char_length(trim(name)) between 1 and 80
  )
);

create unique index if not exists communities_slug_unique_idx
  on public.communities (lower(slug));

create index if not exists communities_owner_idx
  on public.communities (owner_id, created_at desc);

create index if not exists communities_visibility_status_idx
  on public.communities (visibility, status, created_at desc);

create table if not exists public.community_memberships (
  community_id uuid not null references public.communities (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.community_role not null default 'member',
  status public.community_member_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (community_id, profile_id)
);

create index if not exists community_memberships_profile_idx
  on public.community_memberships (profile_id, status, created_at desc);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.is_collaboration_owner(target_collaboration uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.creator_collaborations collaboration
    where collaboration.id = target_collaboration
      and collaboration.owner_id = auth.uid()
  );
$$;

create or replace function public.is_collaboration_member(target_collaboration uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.creator_collaboration_members member
    where member.collaboration_id = target_collaboration
      and member.profile_id = auth.uid()
      and member.status = 'active'
  );
$$;

create or replace function public.seed_collaboration_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.creator_collaboration_members (
    collaboration_id,
    profile_id,
    role,
    status,
    joined_at
  )
  values (
    new.id,
    new.owner_id,
    'owner',
    'active',
    new.created_at
  )
  on conflict (collaboration_id, profile_id) do update
    set role = excluded.role,
        status = excluded.status,
        joined_at = coalesce(
          public.creator_collaboration_members.joined_at,
          excluded.joined_at
        );

  return new;
end;
$$;

create or replace function public.is_community_admin(target_community uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.community_memberships membership
    where membership.community_id = target_community
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'moderator')
  );
$$;

create or replace function public.is_community_member(target_community uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.community_memberships membership
    where membership.community_id = target_community
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
  );
$$;

create or replace function public.seed_community_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.community_memberships (
    community_id,
    profile_id,
    role,
    status
  )
  values (
    new.id,
    new.owner_id,
    'owner',
    'active'
  )
  on conflict (community_id, profile_id) do update
    set role = excluded.role,
        status = excluded.status;

  return new;
end;
$$;

insert into public.profiles (id)
select users.id
from auth.users as users
on conflict (id) do nothing;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_creator_launches_updated_at on public.creator_launches;
create trigger set_creator_launches_updated_at
  before update on public.creator_launches
  for each row execute function public.set_updated_at();

drop trigger if exists set_creator_collaborations_updated_at on public.creator_collaborations;
create trigger set_creator_collaborations_updated_at
  before update on public.creator_collaborations
  for each row execute function public.set_updated_at();

drop trigger if exists set_creator_collaboration_members_updated_at on public.creator_collaboration_members;
create trigger set_creator_collaboration_members_updated_at
  before update on public.creator_collaboration_members
  for each row execute function public.set_updated_at();

drop trigger if exists set_communities_updated_at on public.communities;
create trigger set_communities_updated_at
  before update on public.communities
  for each row execute function public.set_updated_at();

drop trigger if exists set_community_memberships_updated_at on public.community_memberships;
create trigger set_community_memberships_updated_at
  before update on public.community_memberships
  for each row execute function public.set_updated_at();

drop trigger if exists seed_creator_collaboration_owner on public.creator_collaborations;
create trigger seed_creator_collaboration_owner
  after insert on public.creator_collaborations
  for each row execute function public.seed_collaboration_owner_membership();

drop trigger if exists seed_community_owner on public.communities;
create trigger seed_community_owner
  after insert on public.communities
  for each row execute function public.seed_community_owner_membership();

alter table public.profiles enable row level security;
alter table public.creator_launches enable row level security;
alter table public.creator_collaborations enable row level security;
alter table public.creator_collaboration_members enable row level security;
alter table public.communities enable row level security;
alter table public.community_memberships enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles
  for select
  using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "creator_launches_select_visible" on public.creator_launches;
create policy "creator_launches_select_visible"
  on public.creator_launches
  for select
  using (
    status = 'launched'
    or auth.uid() = created_by
  );

drop policy if exists "creator_launches_insert_owner" on public.creator_launches;
create policy "creator_launches_insert_owner"
  on public.creator_launches
  for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "creator_launches_update_owner" on public.creator_launches;
create policy "creator_launches_update_owner"
  on public.creator_launches
  for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "creator_launches_delete_owner" on public.creator_launches;
create policy "creator_launches_delete_owner"
  on public.creator_launches
  for delete
  to authenticated
  using (
    auth.uid() = created_by
    and status in ('draft', 'failed', 'archived')
  );

drop policy if exists "creator_collaborations_select_visible" on public.creator_collaborations;
create policy "creator_collaborations_select_visible"
  on public.creator_collaborations
  for select
  using (
    status = 'open'
    or auth.uid() = owner_id
    or public.is_collaboration_member(id)
  );

drop policy if exists "creator_collaborations_insert_owner" on public.creator_collaborations;
create policy "creator_collaborations_insert_owner"
  on public.creator_collaborations
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "creator_collaborations_update_owner" on public.creator_collaborations;
create policy "creator_collaborations_update_owner"
  on public.creator_collaborations
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "creator_collaborations_delete_owner" on public.creator_collaborations;
create policy "creator_collaborations_delete_owner"
  on public.creator_collaborations
  for delete
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "creator_collaboration_members_select_visible" on public.creator_collaboration_members;
create policy "creator_collaboration_members_select_visible"
  on public.creator_collaboration_members
  for select
  using (
    auth.uid() = profile_id
    or public.is_collaboration_owner(collaboration_id)
    or (
      status = 'active'
      and exists (
        select 1
        from public.creator_collaborations collaboration
        where collaboration.id = collaboration_id
          and collaboration.status = 'open'
      )
    )
  );

drop policy if exists "creator_collaboration_members_insert_owner_or_self" on public.creator_collaboration_members;
create policy "creator_collaboration_members_insert_owner_or_self"
  on public.creator_collaboration_members
  for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    or public.is_collaboration_owner(collaboration_id)
  );

drop policy if exists "creator_collaboration_members_update_owner_or_self" on public.creator_collaboration_members;
create policy "creator_collaboration_members_update_owner_or_self"
  on public.creator_collaboration_members
  for update
  to authenticated
  using (
    auth.uid() = profile_id
    or public.is_collaboration_owner(collaboration_id)
  )
  with check (
    auth.uid() = profile_id
    or public.is_collaboration_owner(collaboration_id)
  );

drop policy if exists "creator_collaboration_members_delete_owner_or_self" on public.creator_collaboration_members;
create policy "creator_collaboration_members_delete_owner_or_self"
  on public.creator_collaboration_members
  for delete
  to authenticated
  using (
    auth.uid() = profile_id
    or public.is_collaboration_owner(collaboration_id)
  );

drop policy if exists "communities_select_visible" on public.communities;
create policy "communities_select_visible"
  on public.communities
  for select
  using (
    (visibility = 'public' and status = 'active')
    or auth.uid() = owner_id
    or public.is_community_member(id)
  );

drop policy if exists "communities_insert_owner" on public.communities;
create policy "communities_insert_owner"
  on public.communities
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "communities_update_owner" on public.communities;
create policy "communities_update_owner"
  on public.communities
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "communities_delete_owner" on public.communities;
create policy "communities_delete_owner"
  on public.communities
  for delete
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "community_memberships_select_visible" on public.community_memberships;
create policy "community_memberships_select_visible"
  on public.community_memberships
  for select
  using (
    auth.uid() = profile_id
    or public.is_community_admin(community_id)
    or (
      status = 'active'
      and exists (
        select 1
        from public.communities community
        where community.id = community_id
          and community.visibility = 'public'
          and community.status = 'active'
      )
    )
  );

drop policy if exists "community_memberships_insert_owner_or_self" on public.community_memberships;
create policy "community_memberships_insert_owner_or_self"
  on public.community_memberships
  for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    or public.is_community_admin(community_id)
  );

drop policy if exists "community_memberships_update_owner_or_self" on public.community_memberships;
create policy "community_memberships_update_owner_or_self"
  on public.community_memberships
  for update
  to authenticated
  using (
    auth.uid() = profile_id
    or public.is_community_admin(community_id)
  )
  with check (
    auth.uid() = profile_id
    or public.is_community_admin(community_id)
  );

drop policy if exists "community_memberships_delete_owner_or_self" on public.community_memberships;
create policy "community_memberships_delete_owner_or_self"
  on public.community_memberships
  for delete
  to authenticated
  using (
    auth.uid() = profile_id
    or public.is_community_admin(community_id)
  );

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

grant select on public.creator_launches to anon, authenticated;
grant insert, update, delete on public.creator_launches to authenticated;

grant select on public.creator_collaborations to anon, authenticated;
grant insert, update, delete on public.creator_collaborations to authenticated;

grant select on public.creator_collaboration_members to anon, authenticated;
grant insert, update, delete on public.creator_collaboration_members to authenticated;

grant select on public.communities to anon, authenticated;
grant insert, update, delete on public.communities to authenticated;

grant select on public.community_memberships to anon, authenticated;
grant insert, update, delete on public.community_memberships to authenticated;

comment on table public.profiles is
  'Supabase-backed Every1 profile records keyed by auth.users for off-chain app state.';

comment on table public.creator_launches is
  'Off-chain creator coin launch drafts and launch records that back the new /create flow.';

comment on table public.creator_collaborations is
  'Future collaboration workspace records for the disabled Collaboration create tab.';

comment on table public.communities is
  'Future Every1 community records for the disabled Community create tab and missions/community surfaces.';
