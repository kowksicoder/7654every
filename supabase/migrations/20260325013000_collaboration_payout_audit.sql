create or replace function public.list_profile_collaboration_payouts(
  input_profile_id uuid
)
returns table (
  allocation_id uuid,
  collaboration_id uuid,
  title text,
  ticker text,
  coin_address text,
  coin_symbol text,
  amount numeric,
  split_percent numeric,
  status text,
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
  select
    allocation.id as allocation_id,
    allocation.collaboration_id,
    collaboration.title,
    launch.ticker,
    coalesce(lower(launch.coin_address), allocation.coin_address) as coin_address,
    allocation.coin_symbol,
    allocation.amount,
    allocation.split_percent,
    allocation.status,
    allocation.recipient_wallet_address,
    allocation.error_message,
    allocation.created_at,
    allocation.payout_attempted_at,
    allocation.sent_at,
    allocation.tx_hash
  from public.collaboration_earning_allocations allocation
  inner join public.creator_collaborations collaboration
    on collaboration.id = allocation.collaboration_id
  inner join public.creator_launches launch
    on launch.id = allocation.launch_id
  where allocation.profile_id = input_profile_id
  order by
    coalesce(allocation.sent_at, allocation.payout_attempted_at, allocation.created_at) desc,
    allocation.created_at desc;
$$;

create or replace function public.list_staff_collaboration_payouts(
  input_session_token text,
  input_status text default null,
  input_limit integer default 100,
  input_offset integer default 0
)
returns table (
  allocation_id uuid,
  collaboration_id uuid,
  title text,
  ticker text,
  coin_address text,
  coin_symbol text,
  amount numeric,
  split_percent numeric,
  status text,
  owner_profile_id uuid,
  owner_name text,
  owner_username text,
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
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_status text := nullif(lower(trim(coalesce(input_status, ''))), '');
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  if normalized_status is not null
    and normalized_status not in ('failed', 'paid', 'recorded') then
    raise exception 'Unsupported payout status filter.';
  end if;

  return query
  select
    allocation.id as allocation_id,
    allocation.collaboration_id,
    collaboration.title,
    launch.ticker,
    coalesce(lower(launch.coin_address), allocation.coin_address) as coin_address,
    allocation.coin_symbol,
    allocation.amount,
    allocation.split_percent,
    allocation.status,
    collaboration.owner_id as owner_profile_id,
    owner_profile.display_name as owner_name,
    owner_profile.username as owner_username,
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
  inner join public.creator_collaborations collaboration
    on collaboration.id = allocation.collaboration_id
  inner join public.creator_launches launch
    on launch.id = allocation.launch_id
  inner join public.profiles recipient_profile
    on recipient_profile.id = allocation.profile_id
  inner join public.profiles owner_profile
    on owner_profile.id = collaboration.owner_id
  where normalized_status is null
    or allocation.status = normalized_status
  order by
    coalesce(allocation.sent_at, allocation.payout_attempted_at, allocation.created_at) desc,
    allocation.created_at desc
  limit greatest(coalesce(input_limit, 100), 1)
  offset greatest(coalesce(input_offset, 0), 0);
end;
$$;

create or replace function public.staff_retry_collaboration_payout(
  input_session_token text,
  input_allocation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allocation_record public.collaboration_earning_allocations%rowtype;
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  select *
  into allocation_record
  from public.collaboration_earning_allocations
  where id = input_allocation_id;

  if not found then
    raise exception 'Collaboration payout allocation not found.';
  end if;

  if allocation_record.status = 'paid' then
    raise exception 'Paid collaboration payouts cannot be retried.';
  end if;

  update public.collaboration_earning_allocations
  set
    status = 'recorded',
    error_message = null,
    payout_attempted_at = null,
    tx_hash = null,
    sent_at = null,
    notification_id = null
  where id = input_allocation_id;

  return jsonb_build_object(
    'id', input_allocation_id,
    'note', 'Payout re-queued',
    'status', 'recorded'
  );
end;
$$;

grant execute on function public.list_profile_collaboration_payouts(uuid) to anon, authenticated;
grant execute on function public.list_staff_collaboration_payouts(text, text, integer, integer) to anon, authenticated;
grant execute on function public.staff_retry_collaboration_payout(text, uuid) to anon, authenticated;

comment on function public.list_profile_collaboration_payouts(uuid) is
  'Lists collaboration payout allocations and delivery status for a profile.';

comment on function public.list_staff_collaboration_payouts(text, text, integer, integer) is
  'Lists collaboration payout allocations for staff audit, including failed and paid rows.';

comment on function public.staff_retry_collaboration_payout(text, uuid) is
  'Re-queues a failed collaboration payout allocation so the runtime can attempt the send again.';
