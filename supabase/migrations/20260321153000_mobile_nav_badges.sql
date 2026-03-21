do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'mobile_nav_badge_key'
  ) then
    create type public.mobile_nav_badge_key as enum (
      'explore_new_coins',
      'leaderboard_updates'
    );
  end if;
end
$$;

create table if not exists public.mobile_nav_badge_states (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge_key public.mobile_nav_badge_key not null,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, badge_key)
);

create index if not exists mobile_nav_badge_states_badge_idx
  on public.mobile_nav_badge_states (badge_key, last_seen_at desc);

create table if not exists public.leaderboard_updates (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid unique references public.creator_launches (id) on delete set null,
  kind text not null default 'launch',
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leaderboard_updates_kind_check check (
    kind in ('launch', 'manual', 'ranking')
  )
);

create index if not exists leaderboard_updates_created_at_idx
  on public.leaderboard_updates (created_at desc);

create or replace function public.create_leaderboard_update_for_launch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'launched'
    and (
      tg_op = 'INSERT'
      or (tg_op = 'UPDATE' and old.status is distinct from new.status)
    ) then
    insert into public.leaderboard_updates (
      launch_id,
      kind,
      title,
      body,
      metadata,
      created_at
    )
    values (
      new.id,
      'launch',
      'New coin listed',
      coalesce(
        nullif(trim(new.name), ''),
        '₦' || upper(new.ticker)
      ) || ' is now live on Every1.',
      jsonb_build_object(
        'chainId', new.chain_id,
        'coinAddress', new.coin_address,
        'createdBy', new.created_by,
        'launchId', new.id,
        'launchedAt', coalesce(new.launched_at, new.created_at),
        'name', new.name,
        'ticker', lower(new.ticker)
      ),
      coalesce(new.launched_at, new.created_at, timezone('utc', now()))
    )
    on conflict (launch_id) do nothing;
  end if;

  return new;
end;
$$;

insert into public.leaderboard_updates (
  launch_id,
  kind,
  title,
  body,
  metadata,
  created_at
)
select
  launch.id,
  'launch',
  'New coin listed',
  coalesce(
    nullif(trim(launch.name), ''),
    '₦' || upper(launch.ticker)
  ) || ' is now live on Every1.',
  jsonb_build_object(
    'chainId', launch.chain_id,
    'coinAddress', launch.coin_address,
    'createdBy', launch.created_by,
    'launchId', launch.id,
    'launchedAt', coalesce(launch.launched_at, launch.created_at),
    'name', launch.name,
    'ticker', lower(launch.ticker)
  ),
  coalesce(launch.launched_at, launch.created_at)
from public.creator_launches launch
where launch.status = 'launched'
on conflict (launch_id) do nothing;

create or replace function public.get_mobile_nav_badge_counts(
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  explore_last_seen timestamptz;
  leaderboard_last_seen timestamptz;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  select badge_state.last_seen_at
  into explore_last_seen
  from public.mobile_nav_badge_states badge_state
  where badge_state.profile_id = input_profile_id
    and badge_state.badge_key = 'explore_new_coins';

  select badge_state.last_seen_at
  into leaderboard_last_seen
  from public.mobile_nav_badge_states badge_state
  where badge_state.profile_id = input_profile_id
    and badge_state.badge_key = 'leaderboard_updates';

  return jsonb_build_object(
    'exploreCount',
    coalesce(
      (
        select count(*)::integer
        from public.creator_launches launch
        where launch.status = 'launched'
          and coalesce(launch.launched_at, launch.created_at) >
            coalesce(explore_last_seen, '-infinity'::timestamptz)
      ),
      0
    ),
    'leaderboardCount',
    coalesce(
      (
        select count(*)::integer
        from public.leaderboard_updates update_item
        where update_item.created_at >
          coalesce(leaderboard_last_seen, '-infinity'::timestamptz)
      ),
      0
    )
  );
end;
$$;

create or replace function public.mark_mobile_nav_badge_seen(
  input_profile_id uuid,
  input_badge_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_badge_key public.mobile_nav_badge_key;
  marked_at timestamptz := timezone('utc', now());
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  begin
    normalized_badge_key := input_badge_key::public.mobile_nav_badge_key;
  exception
    when others then
      raise exception 'unsupported badge key: %', input_badge_key;
  end;

  insert into public.mobile_nav_badge_states (
    profile_id,
    badge_key,
    last_seen_at,
    updated_at
  )
  values (
    input_profile_id,
    normalized_badge_key,
    marked_at,
    marked_at
  )
  on conflict (profile_id, badge_key) do update
    set
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'badgeKey',
    normalized_badge_key::text,
    'lastSeenAt',
    marked_at,
    'profileId',
    input_profile_id
  );
end;
$$;

drop trigger if exists mobile_nav_badge_states_set_updated_at on public.mobile_nav_badge_states;
create trigger mobile_nav_badge_states_set_updated_at
  before update on public.mobile_nav_badge_states
  for each row execute function public.set_updated_at();

drop trigger if exists leaderboard_updates_set_updated_at on public.leaderboard_updates;
create trigger leaderboard_updates_set_updated_at
  before update on public.leaderboard_updates
  for each row execute function public.set_updated_at();

drop trigger if exists creator_launches_create_leaderboard_update on public.creator_launches;
create trigger creator_launches_create_leaderboard_update
  after insert or update of status, launched_at on public.creator_launches
  for each row execute function public.create_leaderboard_update_for_launch();

alter table public.mobile_nav_badge_states enable row level security;
alter table public.leaderboard_updates enable row level security;

drop policy if exists "mobile_nav_badge_states_select_self" on public.mobile_nav_badge_states;
create policy "mobile_nav_badge_states_select_self"
  on public.mobile_nav_badge_states
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "mobile_nav_badge_states_insert_self" on public.mobile_nav_badge_states;
create policy "mobile_nav_badge_states_insert_self"
  on public.mobile_nav_badge_states
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "mobile_nav_badge_states_update_self" on public.mobile_nav_badge_states;
create policy "mobile_nav_badge_states_update_self"
  on public.mobile_nav_badge_states
  for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "leaderboard_updates_select_visible" on public.leaderboard_updates;
create policy "leaderboard_updates_select_visible"
  on public.leaderboard_updates
  for select
  using (true);

grant select on public.mobile_nav_badge_states to authenticated;
grant insert, update on public.mobile_nav_badge_states to authenticated;
grant select on public.leaderboard_updates to anon, authenticated;

grant execute on function public.get_mobile_nav_badge_counts(uuid) to anon, authenticated;
grant execute on function public.mark_mobile_nav_badge_seen(uuid, text) to anon, authenticated;

comment on table public.mobile_nav_badge_states is
  'Per-profile seen state for mobile Explore and Leaderboard badge counts.';

comment on table public.leaderboard_updates is
  'Persistent leaderboard update events used for mobile badge counts and future leaderboard activity feeds.';
