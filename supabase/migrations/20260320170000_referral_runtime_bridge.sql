do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'profiles'
      and constraint_name = 'profiles_id_fkey'
  ) then
    alter table public.profiles drop constraint profiles_id_fkey;
  end if;
end
$$;

alter table public.profiles
  alter column id set default gen_random_uuid();

create unique index if not exists profiles_lens_account_address_unique_idx
  on public.profiles (lower(lens_account_address))
  where lens_account_address is not null;

create unique index if not exists profiles_zora_handle_unique_idx
  on public.profiles (lower(zora_handle))
  where zora_handle is not null;

alter table public.referral_events
  add column if not exists joined_at timestamptz,
  add column if not exists rewarded_at timestamptz,
  add column if not exists first_trade_tx_hash text,
  add column if not exists bonus_bps integer not null default 1000,
  add column if not exists referred_trade_count integer not null default 0;

update public.referral_events
set
  joined_at = coalesce(joined_at, completed_at, created_at),
  rewarded_at = case
    when status = 'rewarded' then coalesce(rewarded_at, updated_at, completed_at, created_at)
    else rewarded_at
  end,
  bonus_bps = coalesce(nullif(bonus_bps, 0), 1000)
where
  joined_at is null
  or (status = 'rewarded' and rewarded_at is null)
  or bonus_bps = 0;

create table if not exists public.referral_trade_rewards (
  id uuid primary key default gen_random_uuid(),
  referral_event_id uuid not null references public.referral_events (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_profile_id uuid not null references public.profiles (id) on delete cascade,
  coin_address text not null,
  coin_symbol text not null,
  trade_side text not null,
  trade_amount_in numeric(36, 18) not null default 0,
  trade_amount_out numeric(36, 18) not null default 0,
  reward_amount numeric(36, 18) not null default 0,
  reward_percent numeric(7, 4) not null default 10,
  tx_hash text not null unique,
  chain_id integer not null default 8453,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint referral_trade_rewards_trade_side_check check (
    trade_side in ('buy', 'sell')
  ),
  constraint referral_trade_rewards_coin_address_format check (
    coin_address ~ '^0x[a-fA-F0-9]{40}$'
  ),
  constraint referral_trade_rewards_tx_hash_format check (
    tx_hash ~ '^0x[a-fA-F0-9]{64}$'
  ),
  constraint referral_trade_rewards_non_negative check (
    trade_amount_in >= 0
    and trade_amount_out >= 0
    and reward_amount >= 0
    and reward_percent >= 0
  )
);

create index if not exists referral_trade_rewards_referrer_idx
  on public.referral_trade_rewards (referrer_id, created_at desc);

create index if not exists referral_trade_rewards_referred_idx
  on public.referral_trade_rewards (referred_profile_id, created_at desc);

create index if not exists referral_trade_rewards_event_idx
  on public.referral_trade_rewards (referral_event_id, created_at desc);

create or replace function public.ensure_referral_code_for_profile(
  target_profile_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  existing_code text;
  base_code text;
  candidate_code text;
begin
  select *
  into profile_row
  from public.profiles
  where id = target_profile_id;

  if not found then
    raise exception 'Profile % not found', target_profile_id;
  end if;

  select code.code
  into existing_code
  from public.referral_codes code
  where code.profile_id = target_profile_id
  order by code.created_at asc
  limit 1;

  if existing_code is not null then
    return existing_code;
  end if;

  base_code := upper(
    regexp_replace(
      coalesce(profile_row.username, split_part(profile_row.id::text, '-', 1)),
      '[^a-zA-Z0-9]',
      '',
      'g'
    )
  );
  base_code := left(coalesce(nullif(base_code, ''), 'E1USER'), 8);
  candidate_code := base_code;

  while exists (
    select 1
    from public.referral_codes code
    where code.code = candidate_code
  ) loop
    candidate_code := left(base_code, 4) ||
      upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 4));
  end loop;

  insert into public.referral_codes (profile_id, code)
  values (target_profile_id, candidate_code)
  on conflict (profile_id) do update
    set code = public.referral_codes.code
  returning code into existing_code;

  return existing_code;
end;
$$;

create or replace function public.ensure_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_referral_code_for_profile(new.id);
  return new;
end;
$$;

create or replace function public.upsert_external_profile(
  input_wallet_address text default null,
  input_lens_account_address text default null,
  input_username text default null,
  input_display_name text default null,
  input_bio text default null,
  input_avatar_url text default null,
  input_banner_url text default null,
  input_zora_handle text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_wallet text := lower(nullif(trim(input_wallet_address), ''));
  normalized_lens text := lower(nullif(trim(input_lens_account_address), ''));
  normalized_username text := lower(
    regexp_replace(coalesce(input_username, ''), '[^a-zA-Z0-9_]', '', 'g')
  );
  normalized_display_name text := nullif(trim(input_display_name), '');
  normalized_bio text := nullif(trim(input_bio), '');
  normalized_avatar text := nullif(trim(input_avatar_url), '');
  normalized_banner text := nullif(trim(input_banner_url), '');
  normalized_zora_handle text := lower(nullif(trim(input_zora_handle), ''));
  lens_profile public.profiles%rowtype;
  wallet_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  ensured_code text;
  total_e1xp bigint;
begin
  if normalized_wallet is null and normalized_lens is null then
    raise exception 'A wallet or lens account address is required.';
  end if;

  if normalized_username = '' or char_length(normalized_username) < 3 then
    normalized_username := null;
  end if;

  if normalized_lens is not null then
    select *
    into lens_profile
    from public.profiles
    where lower(lens_account_address) = normalized_lens
    limit 1;
  end if;

  if normalized_wallet is not null then
    select *
    into wallet_profile
    from public.profiles
    where lower(wallet_address) = normalized_wallet
    limit 1;
  end if;

  if lens_profile.id is not null
    and wallet_profile.id is not null
    and lens_profile.id <> wallet_profile.id then
    raise exception 'Conflicting profile records found for the supplied identity.';
  end if;

  target_profile := coalesce(lens_profile, wallet_profile);

  if target_profile.id is null then
    insert into public.profiles (
      username,
      display_name,
      bio,
      avatar_url,
      banner_url,
      wallet_address,
      lens_account_address,
      zora_handle
    )
    values (
      normalized_username,
      normalized_display_name,
      normalized_bio,
      normalized_avatar,
      normalized_banner,
      normalized_wallet,
      normalized_lens,
      normalized_zora_handle
    )
    returning *
    into target_profile;
  else
    update public.profiles
    set
      username = coalesce(normalized_username, username),
      display_name = coalesce(normalized_display_name, display_name),
      bio = coalesce(normalized_bio, bio),
      avatar_url = coalesce(normalized_avatar, avatar_url),
      banner_url = coalesce(normalized_banner, banner_url),
      wallet_address = coalesce(normalized_wallet, wallet_address),
      lens_account_address = coalesce(normalized_lens, lens_account_address),
      zora_handle = coalesce(normalized_zora_handle, zora_handle)
    where id = target_profile.id
    returning *
    into target_profile;
  end if;

  ensured_code := public.ensure_referral_code_for_profile(target_profile.id);

  select coalesce(sum(ledger.amount), 0)::bigint
  into total_e1xp
  from public.e1xp_ledger ledger
  where ledger.profile_id = target_profile.id;

  return jsonb_build_object(
    'id', target_profile.id,
    'username', target_profile.username,
    'displayName', target_profile.display_name,
    'bio', target_profile.bio,
    'avatarUrl', target_profile.avatar_url,
    'bannerUrl', target_profile.banner_url,
    'walletAddress', target_profile.wallet_address,
    'lensAccountAddress', target_profile.lens_account_address,
    'zoraHandle', target_profile.zora_handle,
    'referralCode', ensured_code,
    'e1xpTotal', coalesce(total_e1xp, 0)
  );
end;
$$;

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
    bonus_bps
  )
  values (
    ref_code.id,
    ref_code.profile_id,
    input_profile_id,
    coalesce(referred_profile.wallet_address, referred_profile.lens_account_address, referred_profile.id::text),
    coalesce(nullif(trim(input_source), ''), 'invite'),
    'completed',
    timezone('utc', now()),
    timezone('utc', now()),
    1000
  )
  returning *
  into existing_event;

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
    format('%s joined Every1 with your invite link.', actor_label),
    null,
    existing_event.id::text,
    jsonb_build_object(
      'referralEventId',
      existing_event.id,
      'referredProfileId',
      input_profile_id,
      'bonusBps',
      existing_event.bonus_bps
    )
  );

  return jsonb_build_object(
    'captured', true,
    'eventId', existing_event.id,
    'referrerId', existing_event.referrer_id,
    'status', existing_event.status
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
    target_event.id::text,
    100,
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
      '%s completed a trade. You earned %s %s and 100 E1XP.',
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
      normalized_tx_hash
    )
  );

  return jsonb_build_object(
    'rewardGranted', true,
    'eventId', target_event.id,
    'tradeRewardId', existing_reward.id,
    'rewardAmount', reward_amount,
    'rewardPercent', reward_percent,
    'rewardSymbol', normalized_symbol,
    'e1xpAwarded', 100
  );
end;
$$;

create or replace function public.get_referral_dashboard(
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  referral_code text;
  joined_count integer;
  rewarded_count integer;
  total_e1xp bigint;
  total_coin_rewards numeric(36, 18);
  recent_referrals jsonb;
  recent_rewards jsonb;
  recent_e1xp jsonb;
begin
  select *
  into profile_row
  from public.profiles
  where id = input_profile_id;

  if not found then
    return jsonb_build_object(
      'profile', null,
      'stats', jsonb_build_object(),
      'recentReferrals', '[]'::jsonb,
      'recentTradeRewards', '[]'::jsonb,
      'recentE1xp', '[]'::jsonb
    );
  end if;

  referral_code := public.ensure_referral_code_for_profile(input_profile_id);

  select
    count(*) filter (where event.status in ('completed', 'rewarded'))::integer,
    count(*) filter (where event.status = 'rewarded')::integer
  into joined_count, rewarded_count
  from public.referral_events event
  where event.referrer_id = input_profile_id;

  select coalesce(sum(ledger.amount), 0)::bigint
  into total_e1xp
  from public.e1xp_ledger ledger
  where ledger.profile_id = input_profile_id;

  select coalesce(sum(reward.reward_amount), 0)
  into total_coin_rewards
  from public.referral_trade_rewards reward
  where reward.referrer_id = input_profile_id;

  select coalesce(
    jsonb_agg(referral_entry order by joined_at desc),
    '[]'::jsonb
  )
  into recent_referrals
  from (
    select jsonb_build_object(
      'id', event.id,
      'status', event.status,
      'joinedAt', event.joined_at,
      'rewardedAt', event.rewarded_at,
      'rewardE1xp', event.reward_e1xp,
      'referredProfileId', event.referred_profile_id,
      'displayName', referred.display_name,
      'username', referred.username,
      'avatarUrl', referred.avatar_url,
      'walletAddress', referred.wallet_address
    ) as referral_entry,
    coalesce(event.joined_at, event.created_at) as joined_at
    from public.referral_events event
    left join public.profiles referred
      on referred.id = event.referred_profile_id
    where event.referrer_id = input_profile_id
    order by coalesce(event.joined_at, event.created_at) desc
    limit 8
  ) recent_referral_rows;

  select coalesce(
    jsonb_agg(reward_entry order by created_at desc),
    '[]'::jsonb
  )
  into recent_rewards
  from (
    select jsonb_build_object(
      'id', reward.id,
      'coinAddress', reward.coin_address,
      'coinSymbol', reward.coin_symbol,
      'rewardAmount', reward.reward_amount,
      'rewardPercent', reward.reward_percent,
      'tradeSide', reward.trade_side,
      'tradeAmountIn', reward.trade_amount_in,
      'tradeAmountOut', reward.trade_amount_out,
      'txHash', reward.tx_hash,
      'createdAt', reward.created_at,
      'referredProfileId', reward.referred_profile_id,
      'displayName', referred.display_name,
      'username', referred.username,
      'avatarUrl', referred.avatar_url
    ) as reward_entry,
    reward.created_at
    from public.referral_trade_rewards reward
    left join public.profiles referred
      on referred.id = reward.referred_profile_id
    where reward.referrer_id = input_profile_id
    order by reward.created_at desc
    limit 8
  ) recent_reward_rows;

  select coalesce(
    jsonb_agg(ledger_entry order by created_at desc),
    '[]'::jsonb
  )
  into recent_e1xp
  from (
    select jsonb_build_object(
      'id', ledger.id,
      'source', ledger.source,
      'amount', ledger.amount,
      'description', ledger.description,
      'createdAt', ledger.created_at,
      'metadata', ledger.metadata
    ) as ledger_entry,
    ledger.created_at
    from public.e1xp_ledger ledger
    where ledger.profile_id = input_profile_id
    order by ledger.created_at desc
    limit 10
  ) recent_e1xp_rows;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', profile_row.id,
      'username', profile_row.username,
      'displayName', profile_row.display_name,
      'avatarUrl', profile_row.avatar_url,
      'walletAddress', profile_row.wallet_address,
      'lensAccountAddress', profile_row.lens_account_address
    ),
    'referralCode', referral_code,
    'bonusPercent', 10,
    'stats', jsonb_build_object(
      'joinedCount', coalesce(joined_count, 0),
      'rewardedCount', coalesce(rewarded_count, 0),
      'totalE1xp', coalesce(total_e1xp, 0),
      'totalCoinRewards', coalesce(total_coin_rewards, 0)
    ),
    'recentReferrals', recent_referrals,
    'recentTradeRewards', recent_rewards,
    'recentE1xp', recent_e1xp
  );
end;
$$;

create or replace function public.list_profile_notifications(
  input_profile_id uuid,
  input_limit integer default 50,
  input_kind text default null
)
returns table (
  id uuid,
  kind public.notification_kind,
  title text,
  body text,
  is_read boolean,
  created_at timestamptz,
  target_key text,
  data jsonb,
  actor_id uuid,
  actor_display_name text,
  actor_username text,
  actor_avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select
    notification.id,
    notification.kind,
    notification.title,
    notification.body,
    notification.is_read,
    notification.created_at,
    notification.target_key,
    notification.data,
    notification.actor_id,
    actor.display_name as actor_display_name,
    actor.username as actor_username,
    actor.avatar_url as actor_avatar_url
  from public.notifications notification
  left join public.profiles actor
    on actor.id = notification.actor_id
  where notification.recipient_id = input_profile_id
    and (
      input_kind is null
      or notification.kind::text = lower(input_kind)
    )
  order by notification.created_at desc
  limit greatest(coalesce(input_limit, 50), 1);
$$;

create or replace function public.get_profile_unread_notification_count(
  input_profile_id uuid
)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.notifications notification
  where notification.recipient_id = input_profile_id
    and notification.is_read = false;
$$;

create or replace function public.mark_profile_notifications_read(
  input_profile_id uuid,
  input_notification_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.notifications
  set
    is_read = true,
    read_at = coalesce(read_at, timezone('utc', now()))
  where recipient_id = input_profile_id
    and is_read = false
    and (
      input_notification_ids is null
      or id = any(input_notification_ids)
    );

  get diagnostics updated_count = row_count;
  return coalesce(updated_count, 0);
end;
$$;

drop trigger if exists referral_trade_rewards_set_updated_at on public.referral_trade_rewards;
create trigger referral_trade_rewards_set_updated_at
  before update on public.referral_trade_rewards
  for each row
  execute function public.set_updated_at();

alter table public.referral_trade_rewards enable row level security;

drop policy if exists "referral_trade_rewards_select_participants" on public.referral_trade_rewards;
create policy "referral_trade_rewards_select_participants"
  on public.referral_trade_rewards
  for select
  to authenticated
  using (
    auth.uid() = referrer_id
    or auth.uid() = referred_profile_id
  );

grant execute on function public.ensure_referral_code_for_profile(uuid) to anon, authenticated;
grant execute on function public.upsert_external_profile(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.capture_referral_join(uuid, text, text) to anon, authenticated;
grant execute on function public.record_referral_trade_reward(uuid, text, text, text, numeric, numeric, text, integer) to anon, authenticated;
grant execute on function public.get_referral_dashboard(uuid) to anon, authenticated;
grant execute on function public.list_profile_notifications(uuid, integer, text) to anon, authenticated;
grant execute on function public.get_profile_unread_notification_count(uuid) to anon, authenticated;
grant execute on function public.mark_profile_notifications_read(uuid, uuid[]) to anon, authenticated;

grant select on public.referral_trade_rewards to authenticated;

comment on table public.referral_trade_rewards is
  'First-trade referral commission ledger, including creator coin bonus amounts and the triggering trade transaction.';
