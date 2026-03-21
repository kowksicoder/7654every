insert into public.e1xp_ledger (
  profile_id,
  source,
  source_key,
  amount,
  description,
  metadata
)
select
  event.referrer_id,
  'referral',
  format('join:%s', event.id),
  50,
  'Referral join reward',
  jsonb_build_object(
    'referralEventId',
    event.id,
    'referredProfileId',
    event.referred_profile_id,
    'backfilled',
    true
  )
from public.referral_events event
where event.status in ('completed', 'rewarded')
  and coalesce(event.reward_e1xp, 0) = 0
  and not exists (
    select 1
    from public.e1xp_ledger ledger
    where ledger.profile_id = event.referrer_id
      and ledger.source = 'referral'
      and ledger.source_key in (
        event.id::text,
        format('join:%s', event.id)
      )
  );

update public.referral_events event
set reward_e1xp = greatest(coalesce(event.reward_e1xp, 0), 50)
where event.status in ('completed', 'rewarded')
  and exists (
    select 1
    from public.e1xp_ledger ledger
    where ledger.profile_id = event.referrer_id
      and ledger.source = 'referral'
      and ledger.source_key = format('join:%s', event.id)
  );

create or replace function public.capture_referral_join(
  input_profile_id uuid,
  input_referral_code text,
  input_source text default 'invite'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(
    regexp_replace(coalesce(input_referral_code, ''), '[^a-zA-Z0-9]', '', 'g')
  );
  referred_profile public.profiles%rowtype;
  ref_code public.referral_codes%rowtype;
  existing_event public.referral_events%rowtype;
  actor_label text;
begin
  if input_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if normalized_code = '' then
    raise exception 'Referral code is required.';
  end if;

  select *
  into referred_profile
  from public.profiles
  where id = input_profile_id;

  if not found then
    raise exception 'Profile % not found.', input_profile_id;
  end if;

  select *
  into ref_code
  from public.referral_codes
  where code = normalized_code
    and is_active = true
  limit 1;

  if ref_code.id is null then
    return jsonb_build_object(
      'captured', false,
      'reason', 'invalid_code'
    );
  end if;

  if ref_code.profile_id = input_profile_id then
    return jsonb_build_object(
      'captured', false,
      'reason', 'self_referral'
    );
  end if;

  select *
  into existing_event
  from public.referral_events
  where referred_profile_id = input_profile_id
  order by created_at asc
  limit 1;

  if existing_event.id is not null then
    return jsonb_build_object(
      'captured', false,
      'reason', 'already_captured',
      'eventId', existing_event.id,
      'status', existing_event.status
    );
  end if;

  insert into public.referral_events (
    referral_code_id,
    referrer_id,
    referred_profile_id,
    referred_identifier,
    source,
    status,
    joined_at,
    completed_at,
    bonus_bps,
    reward_e1xp
  )
  values (
    ref_code.id,
    ref_code.profile_id,
    input_profile_id,
    coalesce(
      referred_profile.wallet_address,
      referred_profile.lens_account_address,
      referred_profile.id::text
    ),
    coalesce(nullif(trim(input_source), ''), 'invite'),
    'completed',
    timezone('utc', now()),
    timezone('utc', now()),
    1000,
    50
  )
  returning *
  into existing_event;

  insert into public.e1xp_ledger (
    profile_id,
    source,
    source_key,
    amount,
    description,
    metadata
  )
  values (
    existing_event.referrer_id,
    'referral',
    format('join:%s', existing_event.id),
    50,
    'Referral join reward',
    jsonb_build_object(
      'referralEventId',
      existing_event.id,
      'referredProfileId',
      input_profile_id
    )
  );

  actor_label := coalesce(
    nullif(referred_profile.display_name, ''),
    nullif(referred_profile.username, ''),
    'A new creator'
  );

  perform public.create_notification(
    ref_code.profile_id,
    input_profile_id,
    'referral',
    'New referral joined',
    format('%s joined with your invite. You earned 50 E1XP.', actor_label),
    null,
    existing_event.id::text,
    jsonb_build_object(
      'referralEventId',
      existing_event.id,
      'referredProfileId',
      input_profile_id,
      'bonusBps',
      existing_event.bonus_bps,
      'e1xpAwarded',
      50
    )
  );

  return jsonb_build_object(
    'captured', true,
    'eventId', existing_event.id,
    'referrerId', existing_event.referrer_id,
    'status', existing_event.status,
    'e1xpAwarded', 50
  );
end;
$$;

create or replace function public.record_referral_trade_reward(
  input_profile_id uuid,
  input_coin_address text,
  input_coin_symbol text,
  input_trade_side text,
  input_trade_amount_in numeric,
  input_trade_amount_out numeric,
  input_tx_hash text,
  input_chain_id integer default 8453
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_side text := lower(nullif(trim(input_trade_side), ''));
  normalized_symbol text := upper(coalesce(nullif(trim(input_coin_symbol), ''), 'COIN'));
  normalized_tx_hash text := lower(nullif(trim(input_tx_hash), ''));
  target_event public.referral_events%rowtype;
  referred_profile public.profiles%rowtype;
  existing_reward public.referral_trade_rewards%rowtype;
  reward_basis numeric(36, 18);
  reward_amount numeric(36, 18);
  reward_percent numeric(7, 4);
  actor_label text;
begin
  if input_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if normalized_side not in ('buy', 'sell') then
    raise exception 'Trade side must be buy or sell.';
  end if;

  if normalized_tx_hash is null then
    raise exception 'A transaction hash is required.';
  end if;

  select *
  into existing_reward
  from public.referral_trade_rewards
  where tx_hash = normalized_tx_hash
  limit 1;

  if existing_reward.id is not null then
    return jsonb_build_object(
      'rewardGranted', false,
      'reason', 'duplicate_transaction',
      'tradeRewardId', existing_reward.id
    );
  end if;

  select *
  into target_event
  from public.referral_events
  where referred_profile_id = input_profile_id
  order by created_at asc
  limit 1;

  if target_event.id is null then
    return jsonb_build_object(
      'rewardGranted', false,
      'reason', 'no_referral'
    );
  end if;

  if target_event.status = 'rewarded'
    or exists (
      select 1
      from public.referral_trade_rewards trade_reward
      where trade_reward.referral_event_id = target_event.id
    ) then
    return jsonb_build_object(
      'rewardGranted', false,
      'reason', 'already_rewarded',
      'eventId', target_event.id
    );
  end if;

  select *
  into referred_profile
  from public.profiles
  where id = input_profile_id;

  reward_basis := case
    when normalized_side = 'buy' then greatest(coalesce(input_trade_amount_out, 0), 0)
    else greatest(coalesce(input_trade_amount_in, 0), 0)
  end;
  reward_amount := round((reward_basis * target_event.bonus_bps::numeric / 10000), 18);
  reward_percent := round((target_event.bonus_bps::numeric / 100), 4);

  insert into public.referral_trade_rewards (
    referral_event_id,
    referrer_id,
    referred_profile_id,
    coin_address,
    coin_symbol,
    trade_side,
    trade_amount_in,
    trade_amount_out,
    reward_amount,
    reward_percent,
    tx_hash,
    chain_id,
    metadata
  )
  values (
    target_event.id,
    target_event.referrer_id,
    input_profile_id,
    input_coin_address,
    normalized_symbol,
    normalized_side,
    greatest(coalesce(input_trade_amount_in, 0), 0),
    greatest(coalesce(input_trade_amount_out, 0), 0),
    reward_amount,
    reward_percent,
    normalized_tx_hash,
    coalesce(input_chain_id, 8453),
    jsonb_build_object(
      'bonusBps',
      target_event.bonus_bps
    )
  )
  returning *
  into existing_reward;

  update public.referral_events
  set
    status = 'rewarded',
    reward_e1xp = greatest(coalesce(reward_e1xp, 0), 100),
    rewarded_at = timezone('utc', now()),
    first_trade_tx_hash = normalized_tx_hash,
    referred_trade_count = coalesce(referred_trade_count, 0) + 1
  where id = target_event.id
  returning *
  into target_event;

  insert into public.e1xp_ledger (
    profile_id,
    source,
    source_key,
    amount,
    description,
    metadata
  )
  values (
    target_event.referrer_id,
    'referral',
    format('trade:%s', target_event.id),
    50,
    'Referral trade reward',
    jsonb_build_object(
      'referralEventId',
      target_event.id,
      'referredProfileId',
      input_profile_id,
      'tradeRewardId',
      existing_reward.id,
      'coinSymbol',
      normalized_symbol,
      'rewardAmount',
      reward_amount
    )
  );

  actor_label := coalesce(
    nullif(referred_profile.display_name, ''),
    nullif(referred_profile.username, ''),
    'Your referral'
  );

  perform public.create_notification(
    target_event.referrer_id,
    input_profile_id,
    'referral',
    'Referral reward unlocked',
    format(
      '%s completed a trade. You earned %s %s and 50 E1XP.',
      actor_label,
      trim(trailing '.' from trim(trailing '0' from reward_amount::text)),
      normalized_symbol
    ),
    null,
    existing_reward.id::text,
    jsonb_build_object(
      'tradeRewardId',
      existing_reward.id,
      'rewardAmount',
      reward_amount,
      'rewardPercent',
      reward_percent,
      'coinSymbol',
      normalized_symbol,
      'txHash',
      normalized_tx_hash,
      'e1xpAwarded',
      50
    )
  );

  return jsonb_build_object(
    'rewardGranted', true,
    'eventId', target_event.id,
    'tradeRewardId', existing_reward.id,
    'rewardAmount', reward_amount,
    'rewardPercent', reward_percent,
    'rewardSymbol', normalized_symbol,
    'e1xpAwarded', 50
  );
end;
$$;
