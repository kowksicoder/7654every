alter table public.collaboration_earning_allocations
  add column if not exists reward_token_decimals integer not null default 18,
  add column if not exists reward_amount_raw numeric(78, 0),
  add column if not exists recipient_wallet_address text,
  add column if not exists tx_hash text,
  add column if not exists notification_id uuid references public.notifications (id) on delete set null,
  add column if not exists sent_at timestamptz,
  add column if not exists payout_attempted_at timestamptz,
  add column if not exists error_message text;

update public.collaboration_earning_allocations allocation
set
  recipient_wallet_address = lower(nullif(trim(coalesce(profile.wallet_address, '')), '')),
  reward_amount_raw = coalesce(
    allocation.reward_amount_raw,
    trunc(
      allocation.amount * power(10::numeric, coalesce(allocation.reward_token_decimals, 18))
    )
  )
from public.profiles profile
where profile.id = allocation.profile_id
  and (
    allocation.recipient_wallet_address is null
    or allocation.reward_amount_raw is null
  );

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'collaboration_earning_allocations_status_check'
  ) then
    alter table public.collaboration_earning_allocations
      drop constraint collaboration_earning_allocations_status_check;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'collaboration_earning_allocations_status_check'
  ) then
    alter table public.collaboration_earning_allocations
      add constraint collaboration_earning_allocations_status_check check (
        status in ('recorded', 'paid', 'failed')
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'collaboration_earning_allocations_wallet_format'
  ) then
    alter table public.collaboration_earning_allocations
      add constraint collaboration_earning_allocations_wallet_format check (
        recipient_wallet_address is null
        or recipient_wallet_address ~* '^0x[a-f0-9]{40}$'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'collaboration_earning_allocations_decimals_valid'
  ) then
    alter table public.collaboration_earning_allocations
      add constraint collaboration_earning_allocations_decimals_valid check (
        reward_token_decimals between 0 and 36
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'collaboration_earning_allocations_amount_raw_non_negative'
  ) then
    alter table public.collaboration_earning_allocations
      add constraint collaboration_earning_allocations_amount_raw_non_negative check (
        reward_amount_raw is null or reward_amount_raw >= 0
      );
  end if;
end
$$;

create index if not exists collaboration_earning_allocations_payout_idx
  on public.collaboration_earning_allocations (status, payout_attempted_at asc, created_at asc);

create index if not exists collaboration_earning_allocations_wallet_idx
  on public.collaboration_earning_allocations (recipient_wallet_address, sent_at desc)
  where recipient_wallet_address is not null;

create or replace function public.list_profile_reward_tokens(
  input_profile_id uuid
)
returns table (
  last_received_at timestamptz,
  reward_count integer,
  token_address text,
  token_decimals integer,
  token_symbol text
)
language sql
stable
security definer
set search_path = public
as $$
  with reward_tokens as (
    select
      lower(allocation.coin_address) as token_address,
      allocation.coin_symbol as token_symbol,
      allocation.reward_token_decimals as token_decimals,
      coalesce(allocation.sent_at, allocation.created_at) as created_at
    from public.collaboration_earning_allocations allocation
    where allocation.profile_id = input_profile_id
      and allocation.status = 'paid'

    union all

    select
      lower(distribution.reward_token_address) as token_address,
      distribution.reward_token_symbol as token_symbol,
      distribution.reward_token_decimals as token_decimals,
      coalesce(distribution.sent_at, distribution.created_at) as created_at
    from public.fandrop_reward_distributions distribution
    where distribution.recipient_profile_id = input_profile_id
      and distribution.status = 'sent'
  )
  select
    max(reward_tokens.created_at) as last_received_at,
    count(*)::integer as reward_count,
    reward_tokens.token_address,
    min(reward_tokens.token_decimals)::integer as token_decimals,
    min(reward_tokens.token_symbol) as token_symbol
  from reward_tokens
  group by reward_tokens.token_address
  order by max(reward_tokens.created_at) desc, min(reward_tokens.token_symbol);
$$;

create or replace function public.list_profile_wallet_activity(
  input_profile_id uuid
)
returns table (
  activity_id text,
  activity_kind text,
  amount numeric,
  created_at timestamptz,
  source_name text,
  status text,
  target_key text,
  token_address text,
  token_symbol text,
  tx_hash text
)
language sql
stable
security definer
set search_path = public
as $$
  with wallet_activity as (
    select
      allocation.id::text as activity_id,
      'collaboration_payout'::text as activity_kind,
      allocation.amount,
      coalesce(allocation.sent_at, allocation.created_at) as created_at,
      collaboration.title as source_name,
      allocation.status,
      ('/coins/' || lower(allocation.coin_address))::text as target_key,
      lower(allocation.coin_address) as token_address,
      allocation.coin_symbol as token_symbol,
      allocation.tx_hash
    from public.collaboration_earning_allocations allocation
    inner join public.creator_collaborations collaboration
      on collaboration.id = allocation.collaboration_id
    where allocation.profile_id = input_profile_id
      and allocation.status = 'paid'

    union all

    select
      distribution.id::text as activity_id,
      'fandrop_reward'::text as activity_kind,
      distribution.reward_amount as amount,
      coalesce(distribution.sent_at, distribution.created_at) as created_at,
      mission.title as source_name,
      distribution.status::text as status,
      ('/fandrop/' || mission.slug)::text as target_key,
      lower(distribution.reward_token_address) as token_address,
      distribution.reward_token_symbol as token_symbol,
      distribution.tx_hash
    from public.fandrop_reward_distributions distribution
    inner join public.missions mission
      on mission.id = distribution.mission_id
    where distribution.recipient_profile_id = input_profile_id
      and distribution.status = 'sent'
  )
  select
    wallet_activity.activity_id,
    wallet_activity.activity_kind,
    wallet_activity.amount,
    wallet_activity.created_at,
    wallet_activity.source_name,
    wallet_activity.status,
    wallet_activity.target_key,
    wallet_activity.token_address,
    wallet_activity.token_symbol,
    wallet_activity.tx_hash
  from wallet_activity
  order by wallet_activity.created_at desc, wallet_activity.activity_id desc;
$$;

grant execute on function public.list_profile_reward_tokens(uuid) to anon, authenticated;
grant execute on function public.list_profile_wallet_activity(uuid) to anon, authenticated;

comment on function public.list_profile_reward_tokens(uuid) is
  'Returns distinct reward token contracts received by a profile so the wallet can include them in holdings queries.';

comment on function public.list_profile_wallet_activity(uuid) is
  'Returns sent reward activity from FanDrop and collaboration payouts for wallet history views.';
