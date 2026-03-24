alter table public.creator_collaborations
  add column if not exists payouts_paused boolean not null default false,
  add column if not exists payouts_paused_at timestamptz,
  add column if not exists payouts_paused_reason text;

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
        'Collaboration payout queued',
        format(
          'Your %s %s share from "%s" is queued for automatic payout.',
          allocation_amount_label,
          created_earning.coin_symbol,
          collaboration_record.collaboration_title
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

create or replace function public.list_profile_collaboration_settlements(
  input_profile_id uuid
)
returns table (
  collaboration_id uuid,
  title text,
  ticker text,
  coin_address text,
  coin_symbol text,
  reward_token_decimals integer,
  collaboration_status text,
  launch_status text,
  viewer_split_percent numeric,
  source_types text[],
  gross_amount numeric,
  paid_amount numeric,
  queued_amount numeric,
  failed_amount numeric,
  paid_count integer,
  queued_count integer,
  failed_count integer,
  total_count integer,
  payouts_paused boolean,
  payouts_paused_at timestamptz,
  payouts_paused_reason text,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with accessible_collaborations as (
    select distinct
      collaboration.id,
      collaboration.title,
      collaboration.status::text as collaboration_status,
      collaboration.payouts_paused,
      collaboration.payouts_paused_at,
      collaboration.payouts_paused_reason,
      launch.status::text as launch_status,
      launch.ticker,
      lower(launch.coin_address) as coin_address,
      member_lookup.split_percent as viewer_split_percent
    from public.creator_collaborations collaboration
    inner join public.creator_launches launch
      on launch.id = collaboration.launch_id
    left join public.creator_collaboration_members member_lookup
      on member_lookup.collaboration_id = collaboration.id
      and member_lookup.profile_id = input_profile_id
      and member_lookup.status = 'active'
    where collaboration.owner_id = input_profile_id
      or member_lookup.profile_id is not null
  ),
  earning_totals as (
    select
      earning.collaboration_id,
      coalesce(sum(earning.gross_amount), 0) as gross_amount,
      array_remove(array_agg(distinct earning.source_type), null) as source_types,
      max(earning.created_at) as last_earned_at
    from public.collaboration_earnings earning
    group by earning.collaboration_id
  ),
  allocation_totals as (
    select
      allocation.collaboration_id,
      min(allocation.coin_symbol) as coin_symbol,
      min(allocation.reward_token_decimals)::integer as reward_token_decimals,
      coalesce(sum(allocation.amount) filter (where allocation.status = 'paid'), 0) as paid_amount,
      coalesce(sum(allocation.amount) filter (where allocation.status = 'recorded'), 0) as queued_amount,
      coalesce(sum(allocation.amount) filter (where allocation.status = 'failed'), 0) as failed_amount,
      count(*) filter (where allocation.status = 'paid')::integer as paid_count,
      count(*) filter (where allocation.status = 'recorded')::integer as queued_count,
      count(*) filter (where allocation.status = 'failed')::integer as failed_count,
      count(*)::integer as total_count,
      max(coalesce(allocation.sent_at, allocation.payout_attempted_at, allocation.created_at)) as last_allocation_at
    from public.collaboration_earning_allocations allocation
    group by allocation.collaboration_id
  )
  select
    collaboration.id as collaboration_id,
    collaboration.title,
    collaboration.ticker,
    collaboration.coin_address,
    coalesce(allocation.coin_symbol, upper(collaboration.ticker)) as coin_symbol,
    coalesce(allocation.reward_token_decimals, 18) as reward_token_decimals,
    collaboration.collaboration_status,
    collaboration.launch_status,
    coalesce(collaboration.viewer_split_percent, 0) as viewer_split_percent,
    coalesce(earning.source_types, array[]::text[]) as source_types,
    coalesce(earning.gross_amount, 0) as gross_amount,
    coalesce(allocation.paid_amount, 0) as paid_amount,
    coalesce(allocation.queued_amount, 0) as queued_amount,
    coalesce(allocation.failed_amount, 0) as failed_amount,
    coalesce(allocation.paid_count, 0) as paid_count,
    coalesce(allocation.queued_count, 0) as queued_count,
    coalesce(allocation.failed_count, 0) as failed_count,
    coalesce(allocation.total_count, 0) as total_count,
    collaboration.payouts_paused,
    collaboration.payouts_paused_at,
    collaboration.payouts_paused_reason,
    case
      when earning.last_earned_at is null then allocation.last_allocation_at
      when allocation.last_allocation_at is null then earning.last_earned_at
      else greatest(earning.last_earned_at, allocation.last_allocation_at)
    end as last_activity_at
  from accessible_collaborations collaboration
  left join earning_totals earning
    on earning.collaboration_id = collaboration.id
  left join allocation_totals allocation
    on allocation.collaboration_id = collaboration.id
  order by
    case
      when earning.last_earned_at is null then allocation.last_allocation_at
      when allocation.last_allocation_at is null then earning.last_earned_at
      else greatest(earning.last_earned_at, allocation.last_allocation_at)
    end desc nulls last,
    collaboration.title asc;
$$;

create or replace function public.list_profile_collaboration_payout_audit(
  input_profile_id uuid,
  input_collaboration_id uuid default null
)
returns table (
  allocation_id uuid,
  collaboration_id uuid,
  title text,
  ticker text,
  coin_address text,
  coin_symbol text,
  source_type text,
  amount numeric,
  split_percent numeric,
  status text,
  recipient_profile_id uuid,
  recipient_name text,
  recipient_username text,
  recipient_wallet_address text,
  error_message text,
  created_at timestamptz,
  payout_attempted_at timestamptz,
  sent_at timestamptz,
  tx_hash text
)
language sql
stable
security definer
set search_path = public
as $$
  with accessible_collaborations as (
    select distinct collaboration.id
    from public.creator_collaborations collaboration
    left join public.creator_collaboration_members member_lookup
      on member_lookup.collaboration_id = collaboration.id
      and member_lookup.profile_id = input_profile_id
      and member_lookup.status = 'active'
    where collaboration.owner_id = input_profile_id
      or member_lookup.profile_id is not null
  )
  select
    allocation.id as allocation_id,
    allocation.collaboration_id,
    collaboration.title,
    launch.ticker,
    coalesce(lower(launch.coin_address), allocation.coin_address) as coin_address,
    allocation.coin_symbol,
    allocation.source_type,
    allocation.amount,
    allocation.split_percent,
    allocation.status,
    allocation.profile_id as recipient_profile_id,
    recipient_profile.display_name as recipient_name,
    recipient_profile.username as recipient_username,
    allocation.recipient_wallet_address,
    allocation.error_message,
    allocation.created_at,
    allocation.payout_attempted_at,
    allocation.sent_at,
    allocation.tx_hash
  from public.collaboration_earning_allocations allocation
  inner join accessible_collaborations accessible
    on accessible.id = allocation.collaboration_id
  inner join public.creator_collaborations collaboration
    on collaboration.id = allocation.collaboration_id
  inner join public.creator_launches launch
    on launch.id = allocation.launch_id
  inner join public.profiles recipient_profile
    on recipient_profile.id = allocation.profile_id
  where input_collaboration_id is null
    or allocation.collaboration_id = input_collaboration_id
  order by
    coalesce(allocation.sent_at, allocation.payout_attempted_at, allocation.created_at) desc,
    allocation.created_at desc;
$$;

create or replace function public.get_staff_collaboration_payout_summary(
  input_session_token text
)
returns table (
  active_collaboration_count integer,
  paused_collaboration_count integer,
  collaboration_count integer,
  queued_count integer,
  queued_amount numeric,
  paid_count integer,
  paid_amount numeric,
  failed_count integer,
  failed_amount numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  with launched_collaborations as (
    select
      collaboration.id,
      collaboration.status::text as collaboration_status,
      collaboration.payouts_paused
    from public.creator_collaborations collaboration
    where collaboration.launch_id is not null
  )
  select
    count(*) filter (
      where collaboration_status = 'active'
        and payouts_paused = false
    )::integer as active_collaboration_count,
    count(*) filter (where payouts_paused = true)::integer as paused_collaboration_count,
    count(*)::integer as collaboration_count,
    coalesce(count(allocation.id) filter (where allocation.status = 'recorded'), 0)::integer as queued_count,
    coalesce(sum(allocation.amount) filter (where allocation.status = 'recorded'), 0) as queued_amount,
    coalesce(count(allocation.id) filter (where allocation.status = 'paid'), 0)::integer as paid_count,
    coalesce(sum(allocation.amount) filter (where allocation.status = 'paid'), 0) as paid_amount,
    coalesce(count(allocation.id) filter (where allocation.status = 'failed'), 0)::integer as failed_count,
    coalesce(sum(allocation.amount) filter (where allocation.status = 'failed'), 0) as failed_amount
  from launched_collaborations collaboration
  left join public.collaboration_earning_allocations allocation
    on allocation.collaboration_id = collaboration.id;
end;
$$;

create or replace function public.list_staff_collaboration_settlements(
  input_session_token text,
  input_limit integer default 100,
  input_offset integer default 0
)
returns table (
  collaboration_id uuid,
  title text,
  ticker text,
  coin_address text,
  coin_symbol text,
  reward_token_decimals integer,
  collaboration_status text,
  launch_status text,
  owner_profile_id uuid,
  owner_name text,
  owner_username text,
  source_types text[],
  gross_amount numeric,
  paid_amount numeric,
  queued_amount numeric,
  failed_amount numeric,
  paid_count integer,
  queued_count integer,
  failed_count integer,
  total_count integer,
  payouts_paused boolean,
  payouts_paused_at timestamptz,
  payouts_paused_reason text,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  with earning_totals as (
    select
      earning.collaboration_id,
      coalesce(sum(earning.gross_amount), 0) as gross_amount,
      array_remove(array_agg(distinct earning.source_type), null) as source_types,
      max(earning.created_at) as last_earned_at
    from public.collaboration_earnings earning
    group by earning.collaboration_id
  ),
  allocation_totals as (
    select
      allocation.collaboration_id,
      min(allocation.coin_symbol) as coin_symbol,
      min(allocation.reward_token_decimals)::integer as reward_token_decimals,
      coalesce(sum(allocation.amount) filter (where allocation.status = 'paid'), 0) as paid_amount,
      coalesce(sum(allocation.amount) filter (where allocation.status = 'recorded'), 0) as queued_amount,
      coalesce(sum(allocation.amount) filter (where allocation.status = 'failed'), 0) as failed_amount,
      count(*) filter (where allocation.status = 'paid')::integer as paid_count,
      count(*) filter (where allocation.status = 'recorded')::integer as queued_count,
      count(*) filter (where allocation.status = 'failed')::integer as failed_count,
      count(*)::integer as total_count,
      max(coalesce(allocation.sent_at, allocation.payout_attempted_at, allocation.created_at)) as last_allocation_at
    from public.collaboration_earning_allocations allocation
    group by allocation.collaboration_id
  )
  select
    collaboration.id as collaboration_id,
    collaboration.title,
    launch.ticker,
    lower(launch.coin_address) as coin_address,
    coalesce(allocation.coin_symbol, upper(launch.ticker)) as coin_symbol,
    coalesce(allocation.reward_token_decimals, 18) as reward_token_decimals,
    collaboration.status::text as collaboration_status,
    launch.status::text as launch_status,
    collaboration.owner_id as owner_profile_id,
    owner_profile.display_name as owner_name,
    owner_profile.username as owner_username,
    coalesce(earning.source_types, array[]::text[]) as source_types,
    coalesce(earning.gross_amount, 0) as gross_amount,
    coalesce(allocation.paid_amount, 0) as paid_amount,
    coalesce(allocation.queued_amount, 0) as queued_amount,
    coalesce(allocation.failed_amount, 0) as failed_amount,
    coalesce(allocation.paid_count, 0) as paid_count,
    coalesce(allocation.queued_count, 0) as queued_count,
    coalesce(allocation.failed_count, 0) as failed_count,
    coalesce(allocation.total_count, 0) as total_count,
    collaboration.payouts_paused,
    collaboration.payouts_paused_at,
    collaboration.payouts_paused_reason,
    case
      when earning.last_earned_at is null then allocation.last_allocation_at
      when allocation.last_allocation_at is null then earning.last_earned_at
      else greatest(earning.last_earned_at, allocation.last_allocation_at)
    end as last_activity_at
  from public.creator_collaborations collaboration
  inner join public.creator_launches launch
    on launch.id = collaboration.launch_id
  inner join public.profiles owner_profile
    on owner_profile.id = collaboration.owner_id
  left join earning_totals earning
    on earning.collaboration_id = collaboration.id
  left join allocation_totals allocation
    on allocation.collaboration_id = collaboration.id
  order by
    case
      when earning.last_earned_at is null then allocation.last_allocation_at
      when allocation.last_allocation_at is null then earning.last_earned_at
      else greatest(earning.last_earned_at, allocation.last_allocation_at)
    end desc nulls last,
    collaboration.created_at desc
  limit greatest(coalesce(input_limit, 100), 1)
  offset greatest(coalesce(input_offset, 0), 0);
end;
$$;

create or replace function public.staff_retry_failed_collaboration_payouts(
  input_session_token text,
  input_collaboration_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  retried_count integer := 0;
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  update public.collaboration_earning_allocations allocation
  set
    status = 'recorded',
    error_message = null,
    payout_attempted_at = null,
    tx_hash = null,
    sent_at = null,
    notification_id = null
  where allocation.status = 'failed'
    and (
      input_collaboration_id is null
      or allocation.collaboration_id = input_collaboration_id
    );

  get diagnostics retried_count = row_count;

  return jsonb_build_object(
    'collaborationId', input_collaboration_id,
    'retriedCount', retried_count,
    'status', 'recorded'
  );
end;
$$;

create or replace function public.staff_set_collaboration_payout_pause(
  input_session_token text,
  input_collaboration_id uuid,
  input_paused boolean,
  input_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  collaboration_record public.creator_collaborations%rowtype;
  normalized_reason text := nullif(trim(coalesce(input_reason, '')), '');
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  select *
  into collaboration_record
  from public.creator_collaborations
  where id = input_collaboration_id;

  if not found then
    raise exception 'Collaboration not found.';
  end if;

  update public.creator_collaborations
  set
    payouts_paused = input_paused,
    payouts_paused_at = case
      when input_paused then timezone('utc', now())
      else null
    end,
    payouts_paused_reason = case
      when input_paused then normalized_reason
      else null
    end,
    updated_at = timezone('utc', now())
  where id = input_collaboration_id;

  perform public.create_notification(
    collaboration_record.owner_id,
    null,
    'system',
    case
      when input_paused then 'Collaboration payouts paused'
      else 'Collaboration payouts resumed'
    end,
    case
      when input_paused and normalized_reason is not null then
        format(
          'Automatic payouts for "%s" are paused. Reason: %s',
          collaboration_record.title,
          normalized_reason
        )
      when input_paused then
        format(
          'Automatic payouts for "%s" are paused until staff resumes them.',
          collaboration_record.title
        )
      else
        format(
          'Automatic payouts for "%s" are active again.',
          collaboration_record.title
        )
    end,
    null,
    input_collaboration_id::text,
    jsonb_build_object(
      'collaborationId', input_collaboration_id,
      'paused', input_paused,
      'reason', normalized_reason
    )
  );

  return jsonb_build_object(
    'collaborationId', input_collaboration_id,
    'paused', input_paused,
    'reason', normalized_reason
  );
end;
$$;

grant execute on function public.list_profile_collaboration_settlements(uuid) to anon, authenticated;
grant execute on function public.list_profile_collaboration_payout_audit(uuid, uuid) to anon, authenticated;
grant execute on function public.get_staff_collaboration_payout_summary(text) to anon, authenticated;
grant execute on function public.list_staff_collaboration_settlements(text, integer, integer) to anon, authenticated;
grant execute on function public.staff_retry_failed_collaboration_payouts(text, uuid) to anon, authenticated;
grant execute on function public.staff_set_collaboration_payout_pause(text, uuid, boolean, text) to anon, authenticated;

comment on function public.list_profile_collaboration_settlements(uuid) is
  'Returns project-level collaboration payout settlement summaries, revenue sources, and payout state for a profile.';

comment on function public.list_profile_collaboration_payout_audit(uuid, uuid) is
  'Returns all payout allocations for collaborations a profile can manage, across every recipient.';

comment on function public.get_staff_collaboration_payout_summary(text) is
  'Returns aggregate collaboration payout counts and amounts for the staff manager.';

comment on function public.list_staff_collaboration_settlements(text, integer, integer) is
  'Returns project-level collaboration settlement summaries for staff oversight.';

comment on function public.staff_retry_failed_collaboration_payouts(text, uuid) is
  'Bulk re-queues failed collaboration payout allocations, optionally scoped to a collaboration.';

comment on function public.staff_set_collaboration_payout_pause(text, uuid, boolean, text) is
  'Allows staff to pause or resume automatic payout sends for a collaboration.';
