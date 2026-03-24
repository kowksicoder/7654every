create table if not exists public.collaboration_earnings (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.creator_collaborations (id) on delete cascade,
  launch_id uuid not null references public.creator_launches (id) on delete cascade,
  source_type text not null,
  source_id text not null,
  source_profile_id uuid references public.profiles (id) on delete set null,
  coin_address text not null,
  coin_symbol text not null,
  gross_amount numeric(36, 18) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint collaboration_earnings_source_type_check check (
    source_type in ('referral_trade_reward')
  ),
  constraint collaboration_earnings_coin_address_format check (
    coin_address ~ '^0x[a-fA-F0-9]{40}$'
  ),
  constraint collaboration_earnings_non_negative check (
    gross_amount >= 0
  )
);

create unique index if not exists collaboration_earnings_unique_source_idx
  on public.collaboration_earnings (source_type, source_id);

create index if not exists collaboration_earnings_collaboration_idx
  on public.collaboration_earnings (collaboration_id, created_at desc);

create index if not exists collaboration_earnings_profile_source_idx
  on public.collaboration_earnings (source_profile_id, created_at desc)
  where source_profile_id is not null;

drop trigger if exists collaboration_earnings_set_updated_at on public.collaboration_earnings;
create trigger collaboration_earnings_set_updated_at
  before update on public.collaboration_earnings
  for each row execute function public.set_updated_at();

create table if not exists public.collaboration_earning_allocations (
  id uuid primary key default gen_random_uuid(),
  earning_id uuid not null references public.collaboration_earnings (id) on delete cascade,
  collaboration_id uuid not null references public.creator_collaborations (id) on delete cascade,
  launch_id uuid not null references public.creator_launches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  source_type text not null,
  source_id text not null,
  coin_address text not null,
  coin_symbol text not null,
  split_percent numeric(5, 2) not null default 0,
  amount numeric(36, 18) not null default 0,
  status text not null default 'recorded',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint collaboration_earning_allocations_source_type_check check (
    source_type in ('referral_trade_reward')
  ),
  constraint collaboration_earning_allocations_status_check check (
    status in ('recorded', 'paid')
  ),
  constraint collaboration_earning_allocations_coin_address_format check (
    coin_address ~ '^0x[a-fA-F0-9]{40}$'
  ),
  constraint collaboration_earning_allocations_split_percent_range check (
    split_percent >= 0
    and split_percent <= 100
  ),
  constraint collaboration_earning_allocations_non_negative check (
    amount >= 0
  )
);

create unique index if not exists collaboration_earning_allocations_unique_idx
  on public.collaboration_earning_allocations (earning_id, profile_id);

create index if not exists collaboration_earning_allocations_profile_idx
  on public.collaboration_earning_allocations (profile_id, created_at desc);

create index if not exists collaboration_earning_allocations_collaboration_idx
  on public.collaboration_earning_allocations (collaboration_id, created_at desc);

drop trigger if exists collaboration_earning_allocations_set_updated_at on public.collaboration_earning_allocations;
create trigger collaboration_earning_allocations_set_updated_at
  before update on public.collaboration_earning_allocations
  for each row execute function public.set_updated_at();

create or replace function public.sync_collaboration_reward_allocations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  collaboration_record record;
  member_record public.creator_collaboration_members%rowtype;
  created_earning public.collaboration_earnings%rowtype;
  active_member_count integer := 0;
  active_member_index integer := 0;
  remaining_amount numeric(36, 18) := greatest(coalesce(new.reward_amount, 0), 0);
  allocation_amount numeric(36, 18);
  allocation_amount_label text;
begin
  if coalesce(new.reward_amount, 0) <= 0 then
    return new;
  end if;

  select
    collaboration.id as collaboration_id,
    collaboration.title as collaboration_title,
    launch.id as launch_id,
    lower(launch.coin_address) as coin_address
  into collaboration_record
  from public.creator_launches launch
  inner join public.creator_collaborations collaboration
    on collaboration.launch_id = launch.id
  where nullif(trim(coalesce(launch.coin_address, '')), '') is not null
    and lower(launch.coin_address) = lower(new.coin_address)
    and collaboration.status = 'active'
  order by coalesce(collaboration.accepted_at, collaboration.created_at) desc
  limit 1;

  if not found then
    return new;
  end if;

  insert into public.collaboration_earnings (
    collaboration_id,
    launch_id,
    source_type,
    source_id,
    source_profile_id,
    coin_address,
    coin_symbol,
    gross_amount,
    metadata
  )
  values (
    collaboration_record.collaboration_id,
    collaboration_record.launch_id,
    'referral_trade_reward',
    new.id::text,
    new.referrer_id,
    lower(new.coin_address),
    upper(coalesce(nullif(trim(new.coin_symbol), ''), 'COIN')),
    greatest(coalesce(new.reward_amount, 0), 0),
    jsonb_build_object(
      'referralEventId', new.referral_event_id,
      'referredProfileId', new.referred_profile_id,
      'tradeSide', new.trade_side,
      'txHash', new.tx_hash
    )
  )
  on conflict (source_type, source_id) do update
    set updated_at = timezone('utc', now())
  returning * into created_earning;

  select count(*)::integer
  into active_member_count
  from public.creator_collaboration_members member
  where member.collaboration_id = collaboration_record.collaboration_id
    and member.status = 'active';

  if coalesce(active_member_count, 0) = 0 then
    return new;
  end if;

  for member_record in
    select *
    from public.creator_collaboration_members member
    where member.collaboration_id = collaboration_record.collaboration_id
      and member.status = 'active'
    order by
      case when member.role = 'owner' then 0 else 1 end,
      member.created_at
  loop
    active_member_index := active_member_index + 1;

    if active_member_index = active_member_count then
      allocation_amount := greatest(remaining_amount, 0);
    else
      allocation_amount := round(
        greatest(coalesce(new.reward_amount, 0), 0) * coalesce(member_record.split_percent, 0) / 100,
        18
      );
      remaining_amount := greatest(remaining_amount - allocation_amount, 0);
    end if;

    insert into public.collaboration_earning_allocations (
      earning_id,
      collaboration_id,
      launch_id,
      profile_id,
      source_type,
      source_id,
      coin_address,
      coin_symbol,
      split_percent,
      amount,
      status,
      metadata
    )
    values (
      created_earning.id,
      collaboration_record.collaboration_id,
      collaboration_record.launch_id,
      member_record.profile_id,
      created_earning.source_type,
      created_earning.source_id,
      created_earning.coin_address,
      created_earning.coin_symbol,
      coalesce(member_record.split_percent, 0),
      greatest(allocation_amount, 0),
      'recorded',
      jsonb_build_object(
        'referrerProfileId', new.referrer_id,
        'role', member_record.role
      )
    )
    on conflict (earning_id, profile_id) do nothing;

    if member_record.profile_id <> new.referrer_id
      and greatest(allocation_amount, 0) > 0 then
      allocation_amount_label := trim(
        trailing '.'
        from trim(
          trailing '0'
          from greatest(allocation_amount, 0)::text
        )
      );

      perform public.create_notification(
        member_record.profile_id,
        new.referrer_id,
        'system',
        'Collaboration earnings recorded',
        format(
          'Your share from "%s" is %s %s.',
          collaboration_record.collaboration_title,
          allocation_amount_label,
          created_earning.coin_symbol
        ),
        null,
        collaboration_record.collaboration_id::text,
        jsonb_build_object(
          'allocationAmount', greatest(allocation_amount, 0),
          'allocationId',
          (
            select allocation.id
            from public.collaboration_earning_allocations allocation
            where allocation.earning_id = created_earning.id
              and allocation.profile_id = member_record.profile_id
            limit 1
          ),
          'collaborationId', collaboration_record.collaboration_id,
          'earningId', created_earning.id,
          'launchId', collaboration_record.launch_id,
          'sourceType', created_earning.source_type
        )
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists referral_trade_rewards_sync_collaboration_allocations on public.referral_trade_rewards;
create trigger referral_trade_rewards_sync_collaboration_allocations
  after insert on public.referral_trade_rewards
  for each row execute function public.sync_collaboration_reward_allocations();

create or replace function public.get_profile_collaboration_earnings_summary(
  input_profile_id uuid
)
returns table (
  allocation_count integer,
  collaboration_count integer,
  last_earned_at timestamptz,
  latest_amount numeric,
  latest_coin_symbol text
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select
      allocation.amount,
      allocation.coin_symbol,
      allocation.collaboration_id,
      allocation.created_at
    from public.collaboration_earning_allocations allocation
    where allocation.profile_id = input_profile_id
  ),
  latest as (
    select
      scoped.amount,
      scoped.coin_symbol
    from scoped
    order by scoped.created_at desc
    limit 1
  )
  select
    coalesce((select count(*)::integer from scoped), 0) as allocation_count,
    coalesce((select count(distinct scoped.collaboration_id)::integer from scoped), 0) as collaboration_count,
    (select max(scoped.created_at) from scoped) as last_earned_at,
    (select latest.amount from latest) as latest_amount,
    (select latest.coin_symbol from latest) as latest_coin_symbol;
$$;

create or replace function public.list_profile_collaboration_earnings(
  input_profile_id uuid
)
returns table (
  allocation_count integer,
  coin_address text,
  coin_symbol text,
  collaboration_id uuid,
  last_earned_at timestamptz,
  ticker text,
  title text,
  total_amount numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with aggregated as (
    select
      allocation.collaboration_id,
      min(allocation.coin_address) as coin_address,
      min(allocation.coin_symbol) as coin_symbol,
      coalesce(sum(allocation.amount), 0) as total_amount,
      count(*)::integer as allocation_count,
      max(allocation.created_at) as last_earned_at
    from public.collaboration_earning_allocations allocation
    where allocation.profile_id = input_profile_id
    group by allocation.collaboration_id
  )
  select
    aggregated.allocation_count,
    coalesce(lower(launch.coin_address), aggregated.coin_address) as coin_address,
    aggregated.coin_symbol,
    aggregated.collaboration_id,
    aggregated.last_earned_at,
    launch.ticker,
    collaboration.title,
    aggregated.total_amount
  from aggregated
  inner join public.creator_collaborations collaboration
    on collaboration.id = aggregated.collaboration_id
  inner join public.creator_launches launch
    on launch.id = collaboration.launch_id
  order by aggregated.last_earned_at desc, collaboration.created_at desc;
$$;

grant execute on function public.get_profile_collaboration_earnings_summary(uuid) to anon, authenticated;
grant execute on function public.list_profile_collaboration_earnings(uuid) to anon, authenticated;

comment on table public.collaboration_earnings is
  'Gross collaboration reward events captured before they are split across collaboration members.';

comment on table public.collaboration_earning_allocations is
  'Per-profile collaboration reward allocations computed automatically from gross collaboration earnings.';
