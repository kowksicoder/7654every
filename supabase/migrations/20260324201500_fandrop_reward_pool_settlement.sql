do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'fandrop_distribution_type'
  ) then
    create type public.fandrop_distribution_type as enum (
      'equal_split'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'fandrop_reward_settlement_status'
  ) then
    create type public.fandrop_reward_settlement_status as enum (
      'pending_funding',
      'funded',
      'settling',
      'settled',
      'failed'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'fandrop_reward_distribution_status'
  ) then
    create type public.fandrop_reward_distribution_status as enum (
      'pending',
      'sent',
      'failed'
    );
  end if;
end
$$;

create table if not exists public.fandrop_reward_pools (
  mission_id uuid primary key references public.missions (id) on delete cascade,
  creator_profile_id uuid not null references public.profiles (id) on delete cascade,
  reward_token_address text not null,
  reward_token_symbol text not null,
  reward_token_decimals integer not null default 18,
  reward_pool_amount numeric(38, 18) not null,
  reward_pool_amount_raw numeric(78, 0) not null,
  distribution_type public.fandrop_distribution_type not null default 'equal_split',
  winner_limit integer,
  settlement_status public.fandrop_reward_settlement_status not null default 'pending_funding',
  funding_tx_hash text,
  funded_by_wallet_address text,
  funded_at timestamptz,
  settlement_started_at timestamptz,
  settled_at timestamptz,
  last_settlement_attempt_at timestamptz,
  last_settlement_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fandrop_reward_pools_token_address_format check (
    reward_token_address ~* '^0x[a-f0-9]{40}$'
  ),
  constraint fandrop_reward_pools_symbol_length check (
    char_length(trim(reward_token_symbol)) between 1 and 24
  ),
  constraint fandrop_reward_pools_decimals_valid check (
    reward_token_decimals between 0 and 36
  ),
  constraint fandrop_reward_pools_amount_positive check (
    reward_pool_amount > 0 and reward_pool_amount_raw > 0
  ),
  constraint fandrop_reward_pools_winner_limit_positive check (
    winner_limit is null or winner_limit >= 1
  )
);

create index if not exists fandrop_reward_pools_creator_idx
  on public.fandrop_reward_pools (creator_profile_id, created_at desc);

create index if not exists fandrop_reward_pools_settlement_idx
  on public.fandrop_reward_pools (settlement_status, funded_at asc, created_at asc);

create table if not exists public.fandrop_reward_distributions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  recipient_wallet_address text not null,
  reward_token_address text not null,
  reward_token_symbol text not null,
  reward_token_decimals integer not null default 18,
  reward_amount numeric(38, 18) not null,
  reward_amount_raw numeric(78, 0) not null,
  status public.fandrop_reward_distribution_status not null default 'pending',
  tx_hash text,
  notification_id uuid references public.notifications (id) on delete set null,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fandrop_reward_distributions_wallet_format check (
    recipient_wallet_address ~* '^0x[a-f0-9]{40}$'
  ),
  constraint fandrop_reward_distributions_token_format check (
    reward_token_address ~* '^0x[a-f0-9]{40}$'
  ),
  constraint fandrop_reward_distributions_amount_positive check (
    reward_amount > 0 and reward_amount_raw > 0
  ),
  constraint fandrop_reward_distributions_unique unique (
    mission_id,
    recipient_profile_id
  )
);

create index if not exists fandrop_reward_distributions_mission_idx
  on public.fandrop_reward_distributions (mission_id, status, created_at asc);

create index if not exists fandrop_reward_distributions_profile_idx
  on public.fandrop_reward_distributions (recipient_profile_id, created_at desc);

drop trigger if exists fandrop_reward_pools_set_updated_at on public.fandrop_reward_pools;
create trigger fandrop_reward_pools_set_updated_at
  before update on public.fandrop_reward_pools
  for each row execute function public.set_updated_at();

drop trigger if exists fandrop_reward_distributions_set_updated_at on public.fandrop_reward_distributions;
create trigger fandrop_reward_distributions_set_updated_at
  before update on public.fandrop_reward_distributions
  for each row execute function public.set_updated_at();

alter table public.fandrop_reward_pools enable row level security;
alter table public.fandrop_reward_distributions enable row level security;

drop function if exists public.upsert_profile_fandrop_campaign(uuid, uuid, text, text, text, text, text, text, integer, timestamptz, timestamptz, integer, numeric, boolean, public.mission_status);
drop function if exists public.staff_upsert_fandrop_campaign(text, uuid, uuid, text, text, text, text, text, text, integer, timestamptz, timestamptz, integer, numeric, boolean, public.mission_status);
drop function if exists public.list_staff_fandrops(text);

create or replace function public.__upsert_fandrop_campaign_task(
  input_mission_id uuid,
  input_task_key text,
  input_title text,
  input_description text,
  input_task_type public.mission_task_type,
  input_position integer,
  input_target_count integer,
  input_reward_e1xp integer default 0,
  input_config jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_task_id uuid;
begin
  select task.id
  into existing_task_id
  from public.mission_tasks task
  where task.mission_id = input_mission_id
    and lower(task.task_key) = lower(trim(coalesce(input_task_key, '')))
  limit 1;

  if existing_task_id is null then
    insert into public.mission_tasks (
      mission_id,
      task_key,
      title,
      description,
      task_type,
      position,
      target_count,
      reward_e1xp,
      config
    )
    values (
      input_mission_id,
      lower(trim(coalesce(input_task_key, ''))),
      nullif(trim(coalesce(input_title, '')), ''),
      nullif(trim(coalesce(input_description, '')), ''),
      input_task_type,
      coalesce(input_position, 0),
      greatest(coalesce(input_target_count, 1), 1),
      greatest(coalesce(input_reward_e1xp, 0), 0),
      coalesce(input_config, '{}'::jsonb)
    )
    returning id into existing_task_id;
  else
    update public.mission_tasks
    set
      title = nullif(trim(coalesce(input_title, '')), ''),
      description = nullif(trim(coalesce(input_description, '')), ''),
      task_type = input_task_type,
      position = coalesce(input_position, 0),
      target_count = greatest(coalesce(input_target_count, 1), 1),
      reward_e1xp = greatest(coalesce(input_reward_e1xp, 0), 0),
      config = coalesce(input_config, '{}'::jsonb)
    where id = existing_task_id;
  end if;

  return existing_task_id;
end;
$$;

create or replace function public.__upsert_fandrop_reward_pool(
  input_mission_id uuid,
  input_creator_profile_id uuid,
  input_reward_token_address text default null,
  input_reward_token_symbol text default null,
  input_reward_token_decimals integer default 18,
  input_reward_pool_amount numeric default null,
  input_winner_limit integer default null
)
returns public.fandrop_reward_pools
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_pool public.fandrop_reward_pools%rowtype;
  next_pool public.fandrop_reward_pools%rowtype;
  normalized_reward_token_address text := lower(nullif(trim(coalesce(input_reward_token_address, '')), ''));
  normalized_reward_token_symbol text := upper(nullif(trim(coalesce(input_reward_token_symbol, '')), ''));
  normalized_reward_token_decimals integer := least(greatest(coalesce(input_reward_token_decimals, 18), 0), 36);
  normalized_reward_pool_amount numeric := nullif(coalesce(input_reward_pool_amount, 0), 0);
  normalized_winner_limit integer := greatest(coalesce(input_winner_limit, 0), 0);
  normalized_reward_pool_amount_raw numeric(78, 0);
begin
  select *
  into existing_pool
  from public.fandrop_reward_pools pool
  where pool.mission_id = input_mission_id;

  if normalized_winner_limit = 0 then
    normalized_winner_limit := null;
  end if;

  if normalized_reward_token_address is null
    and normalized_reward_token_symbol is null
    and normalized_reward_pool_amount is null then
    if existing_pool.mission_id is not null then
      if existing_pool.funded_at is not null or existing_pool.settlement_status in ('settling', 'settled') then
        raise exception 'Cannot remove a funded FanDrop reward pool.';
      end if;

      delete from public.fandrop_reward_distributions distribution
      where distribution.mission_id = input_mission_id;

      delete from public.fandrop_reward_pools pool
      where pool.mission_id = input_mission_id;
    end if;

    return null;
  end if;

  if normalized_reward_token_address is null
    or normalized_reward_token_symbol is null
    or normalized_reward_pool_amount is null then
    raise exception 'Reward token address, symbol, and pool amount are required together.';
  end if;

  if normalized_reward_token_address !~* '^0x[a-f0-9]{40}$' then
    raise exception 'Enter a valid Base token contract address.';
  end if;

  normalized_reward_pool_amount_raw := trunc(
    normalized_reward_pool_amount * power(10::numeric, normalized_reward_token_decimals)
  );

  if normalized_reward_pool_amount_raw <= 0 then
    raise exception 'Reward pool amount must be greater than zero.';
  end if;

  if existing_pool.mission_id is not null
    and existing_pool.funded_at is not null
    and (
      existing_pool.reward_token_address <> normalized_reward_token_address
      or existing_pool.reward_token_symbol <> normalized_reward_token_symbol
      or existing_pool.reward_token_decimals <> normalized_reward_token_decimals
      or existing_pool.reward_pool_amount_raw <> normalized_reward_pool_amount_raw
      or coalesce(existing_pool.winner_limit, 0) <> coalesce(normalized_winner_limit, 0)
    ) then
    raise exception 'You cannot change a funded FanDrop reward pool.';
  end if;

  insert into public.fandrop_reward_pools (
    mission_id,
    creator_profile_id,
    reward_token_address,
    reward_token_symbol,
    reward_token_decimals,
    reward_pool_amount,
    reward_pool_amount_raw,
    distribution_type,
    winner_limit,
    settlement_status
  )
  values (
    input_mission_id,
    input_creator_profile_id,
    normalized_reward_token_address,
    normalized_reward_token_symbol,
    normalized_reward_token_decimals,
    normalized_reward_pool_amount,
    normalized_reward_pool_amount_raw,
    'equal_split',
    normalized_winner_limit,
    'pending_funding'
  )
  on conflict (mission_id) do update
  set
    creator_profile_id = excluded.creator_profile_id,
    reward_token_address = excluded.reward_token_address,
    reward_token_symbol = excluded.reward_token_symbol,
    reward_token_decimals = excluded.reward_token_decimals,
    reward_pool_amount = excluded.reward_pool_amount,
    reward_pool_amount_raw = excluded.reward_pool_amount_raw,
    distribution_type = excluded.distribution_type,
    winner_limit = excluded.winner_limit,
    settlement_status = case
      when public.fandrop_reward_pools.funded_at is not null
        then public.fandrop_reward_pools.settlement_status
      else 'pending_funding'
    end,
    funding_tx_hash = case
      when public.fandrop_reward_pools.funded_at is not null
        then public.fandrop_reward_pools.funding_tx_hash
      else null
    end,
    funded_by_wallet_address = case
      when public.fandrop_reward_pools.funded_at is not null
        then public.fandrop_reward_pools.funded_by_wallet_address
      else null
    end,
    funded_at = case
      when public.fandrop_reward_pools.funded_at is not null
        then public.fandrop_reward_pools.funded_at
      else null
    end,
    settlement_started_at = case
      when public.fandrop_reward_pools.funded_at is not null
        then public.fandrop_reward_pools.settlement_started_at
      else null
    end,
    settled_at = case
      when public.fandrop_reward_pools.funded_at is not null
        then public.fandrop_reward_pools.settled_at
      else null
    end,
    last_settlement_attempt_at = case
      when public.fandrop_reward_pools.funded_at is not null
        then public.fandrop_reward_pools.last_settlement_attempt_at
      else null
    end,
    last_settlement_error = case
      when public.fandrop_reward_pools.funded_at is not null
        then public.fandrop_reward_pools.last_settlement_error
      else null
    end
  returning * into next_pool;

  return next_pool;
end;
$$;

create or replace function public.upsert_profile_fandrop_campaign(
  input_profile_id uuid,
  input_mission_id uuid default null,
  input_title text default null,
  input_subtitle text default null,
  input_about text default null,
  input_cover_label text default null,
  input_reward_pool_label text default null,
  input_banner_url text default null,
  input_reward_e1xp integer default 0,
  input_starts_at timestamptz default null,
  input_ends_at timestamptz default null,
  input_referral_target integer default 2,
  input_buy_amount numeric default null,
  input_is_buy_optional boolean default true,
  input_status public.mission_status default 'draft',
  input_reward_token_address text default null,
  input_reward_token_symbol text default null,
  input_reward_token_decimals integer default 18,
  input_reward_pool_amount numeric default null,
  input_winner_limit integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  creator_profile public.profiles%rowtype;
  mission_row public.missions%rowtype;
  normalized_title text := nullif(trim(coalesce(input_title, '')), '');
  normalized_subtitle text := nullif(trim(coalesce(input_subtitle, '')), '');
  normalized_about text := nullif(trim(coalesce(input_about, '')), '');
  normalized_cover_label text := nullif(trim(coalesce(input_cover_label, '')), '');
  normalized_reward_pool_label text := nullif(trim(coalesce(input_reward_pool_label, '')), '');
  normalized_banner_url text := nullif(trim(coalesce(input_banner_url, '')), '');
  normalized_reward_e1xp integer := greatest(coalesce(input_reward_e1xp, 0), 0);
  normalized_referral_target integer := greatest(coalesce(input_referral_target, 2), 1);
  normalized_buy_amount numeric := nullif(input_buy_amount, 0);
  normalized_status public.mission_status := coalesce(input_status, 'draft');
  normalized_starts_at timestamptz := input_starts_at;
  normalized_ends_at timestamptz := input_ends_at;
  normalized_reward_token_address text := lower(nullif(trim(coalesce(input_reward_token_address, '')), ''));
  normalized_reward_token_symbol text := upper(nullif(trim(coalesce(input_reward_token_symbol, '')), ''));
  normalized_reward_token_decimals integer := least(greatest(coalesce(input_reward_token_decimals, 18), 0), 36);
  normalized_reward_pool_amount numeric := nullif(coalesce(input_reward_pool_amount, 0), 0);
  normalized_winner_limit integer := greatest(coalesce(input_winner_limit, 0), 0);
  creator_name text;
  creator_handle text;
  creator_wallet text;
  mission_config jsonb;
  base_slug text;
  resolved_slug text;
  slug_suffix integer := 0;
  payment_task_id uuid;
  reward_pool public.fandrop_reward_pools%rowtype;
  derived_reward_pool_label text;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  if normalized_title is null then
    raise exception 'FanDrop title is required.';
  end if;

  if normalized_winner_limit = 0 then
    normalized_winner_limit := null;
  end if;

  select *
  into creator_profile
  from public.profiles profile
  where profile.id = input_profile_id
  limit 1;

  if creator_profile.id is null then
    raise exception 'Creator profile not found.';
  end if;

  if normalized_ends_at is not null
    and normalized_starts_at is not null
    and normalized_ends_at <= normalized_starts_at then
    raise exception 'FanDrop end time must be after the start time.';
  end if;

  if normalized_status = 'active' and normalized_starts_at is null then
    normalized_starts_at := timezone('utc', now());
  end if;

  creator_name := coalesce(
    nullif(trim(coalesce(creator_profile.display_name, '')), ''),
    nullif(trim(coalesce(creator_profile.username, '')), ''),
    creator_profile.wallet_address
  );
  creator_wallet := lower(nullif(trim(coalesce(creator_profile.wallet_address, '')), ''));
  creator_handle := coalesce(
    nullif(trim(coalesce(creator_profile.zora_handle, '')), ''),
    nullif(trim(coalesce(creator_profile.username, '')), '')
  );

  if creator_handle is not null and creator_handle <> '' and creator_handle !~ '^@' then
    creator_handle := '@' || creator_handle;
  end if;

  if input_mission_id is not null then
    select *
    into mission_row
    from public.missions mission
    where mission.id = input_mission_id
      and coalesce(mission.config->>'surface', '') = 'fandrop'
    limit 1;

    if mission_row.id is null then
      raise exception 'FanDrop campaign not found.';
    end if;

    if coalesce(mission_row.config->>'creatorProfileId', '') <> input_profile_id::text then
      raise exception 'You can only edit your own FanDrop campaigns.';
    end if;

    resolved_slug := mission_row.slug;
  else
    base_slug := lower(
      trim(
        both '-'
        from regexp_replace(normalized_title, '[^a-zA-Z0-9]+', '-', 'g')
      )
    );

    if coalesce(base_slug, '') = '' then
      base_slug := 'fandrop';
    end if;

    base_slug := left(base_slug, 42) || '-' || left(replace(input_profile_id::text, '-', ''), 6);
    resolved_slug := base_slug;

    loop
      exit when not exists (
        select 1
        from public.missions mission
        where lower(mission.slug) = lower(resolved_slug)
      );

      slug_suffix := slug_suffix + 1;
      resolved_slug := left(base_slug, 48) || '-' || slug_suffix::text;
    end loop;
  end if;

  derived_reward_pool_label := normalized_reward_pool_label;

  if derived_reward_pool_label is null
    and normalized_reward_pool_amount is not null
    and normalized_reward_token_symbol is not null then
    derived_reward_pool_label := trim(
      to_char(normalized_reward_pool_amount, 'FM999999999999990.################')
    ) || ' ' || normalized_reward_token_symbol;
  end if;

  mission_config := jsonb_build_object(
    'about', normalized_about,
    'coverLabel', coalesce(normalized_cover_label, 'FanDrop'),
    'creatorHandle', creator_handle,
    'creatorName', creator_name,
    'creatorProfileId', input_profile_id,
    'creatorWalletAddress', creator_wallet,
    'rewardPoolLabel', coalesce(derived_reward_pool_label, 'Reward pool live'),
    'surface', 'fandrop'
  );

  if mission_row.id is null then
    insert into public.missions (
      slug,
      title,
      description,
      banner_url,
      status,
      reward_e1xp,
      starts_at,
      ends_at,
      config,
      created_by
    )
    values (
      resolved_slug,
      normalized_title,
      normalized_subtitle,
      normalized_banner_url,
      normalized_status,
      normalized_reward_e1xp,
      normalized_starts_at,
      normalized_ends_at,
      mission_config,
      input_profile_id
    )
    returning * into mission_row;
  else
    update public.missions
    set
      title = normalized_title,
      description = normalized_subtitle,
      banner_url = normalized_banner_url,
      status = normalized_status,
      reward_e1xp = normalized_reward_e1xp,
      starts_at = normalized_starts_at,
      ends_at = normalized_ends_at,
      config = coalesce(public.missions.config, '{}'::jsonb) || mission_config
    where id = mission_row.id
    returning * into mission_row;
  end if;

  perform public.__upsert_fandrop_campaign_task(
    mission_row.id,
    'join',
    'Join',
    'Join the FanDrop to lock your place.',
    'custom',
    0,
    1,
    0,
    jsonb_build_object('action', 'join')
  );

  perform public.__upsert_fandrop_campaign_task(
    mission_row.id,
    'invite-circle',
    format(
      'Invite %s %s',
      normalized_referral_target,
      case when normalized_referral_target = 1 then 'friend' else 'friends' end
    ),
    format(
      'Invite %s %s into Every1 before the FanDrop closes.',
      normalized_referral_target,
      case when normalized_referral_target = 1 then 'friend' else 'friends' end
    ),
    'referral',
    1,
    normalized_referral_target,
    0,
    '{}'::jsonb
  );

  if normalized_buy_amount is not null and normalized_buy_amount > 0 then
    perform public.__upsert_fandrop_campaign_task(
      mission_row.id,
      'buy-amount',
      format(
        'Buy N%s%s',
        trim(to_char(normalized_buy_amount, 'FM999999990.##')),
        case when coalesce(input_is_buy_optional, true) then ' (optional)' else '' end
      ),
      'Complete the optional buy step before the pool closes.',
      'payment',
      2,
      1,
      0,
      jsonb_build_object(
        'minimumAmount', normalized_buy_amount,
        'optional', coalesce(input_is_buy_optional, true)
      )
    );
  else
    select task.id
    into payment_task_id
    from public.mission_tasks task
    where task.mission_id = mission_row.id
      and lower(task.task_key) = 'buy-amount'
    limit 1;

    if payment_task_id is not null then
      delete from public.mission_tasks task
      where task.id = payment_task_id;
    end if;
  end if;

  reward_pool := public.__upsert_fandrop_reward_pool(
    mission_row.id,
    input_profile_id,
    normalized_reward_token_address,
    normalized_reward_token_symbol,
    normalized_reward_token_decimals,
    normalized_reward_pool_amount,
    normalized_winner_limit
  );

  return jsonb_build_object(
    'created', input_mission_id is null,
    'creatorProfileId', input_profile_id,
    'id', mission_row.id,
    'rewardPoolConfigured', reward_pool.mission_id is not null,
    'rewardTokenAddress', reward_pool.reward_token_address,
    'rewardTokenSymbol', reward_pool.reward_token_symbol,
    'rewardPoolAmount', reward_pool.reward_pool_amount,
    'settlementStatus', reward_pool.settlement_status,
    'slug', mission_row.slug,
    'status', mission_row.status,
    'title', mission_row.title
  );
end;
$$;

create or replace function public.staff_upsert_fandrop_campaign(
  input_session_token text,
  input_creator_profile_id uuid,
  input_mission_id uuid default null,
  input_title text default null,
  input_subtitle text default null,
  input_about text default null,
  input_cover_label text default null,
  input_reward_pool_label text default null,
  input_banner_url text default null,
  input_reward_e1xp integer default 0,
  input_starts_at timestamptz default null,
  input_ends_at timestamptz default null,
  input_referral_target integer default 2,
  input_buy_amount numeric default null,
  input_is_buy_optional boolean default true,
  input_status public.mission_status default 'draft',
  input_reward_token_address text default null,
  input_reward_token_symbol text default null,
  input_reward_token_decimals integer default 18,
  input_reward_pool_amount numeric default null,
  input_winner_limit integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return public.upsert_profile_fandrop_campaign(
    input_creator_profile_id,
    input_mission_id,
    input_title,
    input_subtitle,
    input_about,
    input_cover_label,
    input_reward_pool_label,
    input_banner_url,
    input_reward_e1xp,
    input_starts_at,
    input_ends_at,
    input_referral_target,
    input_buy_amount,
    input_is_buy_optional,
    input_status,
    input_reward_token_address,
    input_reward_token_symbol,
    input_reward_token_decimals,
    input_reward_pool_amount,
    input_winner_limit
  );
end;
$$;

create or replace function public.list_staff_fandrops(
  input_session_token text
)
returns table (
  mission_id uuid,
  creator_profile_id uuid,
  creator_name text,
  creator_username text,
  creator_wallet_address text,
  slug text,
  title text,
  subtitle text,
  about text,
  cover_label text,
  reward_pool_label text,
  banner_url text,
  status public.mission_status,
  reward_e1xp integer,
  participant_count bigint,
  task_count bigint,
  referral_target integer,
  buy_amount numeric,
  buy_is_optional boolean,
  reward_token_address text,
  reward_token_symbol text,
  reward_token_decimals integer,
  reward_pool_amount numeric,
  winner_limit integer,
  settlement_status public.fandrop_reward_settlement_status,
  funded_at timestamptz,
  funding_tx_hash text,
  reward_sent_count bigint,
  reward_failed_count bigint,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  with fandrop_tasks as (
    select
      task.mission_id,
      max(task.target_count) filter (where lower(task.task_key) = 'invite-circle') as referral_target,
      max((task.config->>'minimumAmount')::numeric) filter (where lower(task.task_key) = 'buy-amount') as buy_amount,
      bool_or(coalesce((task.config->>'optional')::boolean, false)) filter (where lower(task.task_key) = 'buy-amount') as buy_is_optional,
      count(*)::bigint as task_count
    from public.mission_tasks task
    group by task.mission_id
  ),
  fandrop_participants as (
    select
      lower(participation.campaign_slug) as campaign_slug,
      count(*)::bigint as participant_count
    from public.profile_fandrop_participation participation
    group by lower(participation.campaign_slug)
  ),
  reward_distribution_rollup as (
    select
      distribution.mission_id,
      count(*) filter (where distribution.status = 'sent')::bigint as reward_sent_count,
      count(*) filter (where distribution.status = 'failed')::bigint as reward_failed_count
    from public.fandrop_reward_distributions distribution
    group by distribution.mission_id
  )
  select
    mission.id,
    case
      when coalesce(mission.config->>'creatorProfileId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (mission.config->>'creatorProfileId')::uuid
      else null
    end,
    coalesce(profile.display_name, mission.config->>'creatorName'),
    coalesce(profile.username, nullif(trim(coalesce(mission.config->>'creatorHandle', '')), '')),
    coalesce(profile.wallet_address, mission.config->>'creatorWalletAddress'),
    mission.slug,
    mission.title,
    mission.description,
    mission.config->>'about',
    mission.config->>'coverLabel',
    coalesce(
      mission.config->>'rewardPoolLabel',
      case
        when pool.reward_pool_amount is not null and pool.reward_token_symbol is not null then
          trim(to_char(pool.reward_pool_amount, 'FM999999999999990.################')) || ' ' || pool.reward_token_symbol
        else null
      end
    ),
    mission.banner_url,
    mission.status,
    mission.reward_e1xp,
    coalesce(participants.participant_count, 0),
    coalesce(tasks.task_count, 0),
    coalesce(tasks.referral_target, 0),
    tasks.buy_amount,
    coalesce(tasks.buy_is_optional, false),
    pool.reward_token_address,
    pool.reward_token_symbol,
    pool.reward_token_decimals,
    pool.reward_pool_amount,
    pool.winner_limit,
    pool.settlement_status,
    pool.funded_at,
    pool.funding_tx_hash,
    coalesce(distribution_rollup.reward_sent_count, 0),
    coalesce(distribution_rollup.reward_failed_count, 0),
    mission.starts_at,
    mission.ends_at,
    mission.created_at
  from public.missions mission
  left join public.profiles profile
    on profile.id = case
      when coalesce(mission.config->>'creatorProfileId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (mission.config->>'creatorProfileId')::uuid
      else null
    end
  left join fandrop_tasks tasks
    on tasks.mission_id = mission.id
  left join fandrop_participants participants
    on participants.campaign_slug = lower(mission.slug)
  left join public.fandrop_reward_pools pool
    on pool.mission_id = mission.id
  left join reward_distribution_rollup distribution_rollup
    on distribution_rollup.mission_id = mission.id
  where coalesce(mission.config->>'surface', '') = 'fandrop'
    and mission.status <> 'archived'
  order by mission.created_at desc;
end;
$$;

create or replace function public.get_profile_fandrops(
  input_profile_id uuid default null,
  input_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_utc_time timestamptz := timezone('utc', now());
  mission_row record;
  task_row record;
  reward_pool_row public.fandrop_reward_pools%rowtype;
  joined_at_value timestamptz;
  participant_count integer;
  rank_value integer;
  current_value integer;
  completed_count integer;
  progress_label text;
  required_completed_count integer;
  required_task_count integer;
  tasks_json jsonb;
  result_json jsonb := '[]'::jsonb;
  task_is_optional boolean;
  task_state text;
  minimum_amount numeric;
  time_label text;
  diff_seconds integer;
  reward_sent_count integer;
  reward_failed_count integer;
  resolved_reward_pool_label text;
begin
  for mission_row in
    select
      mission.id,
      mission.slug,
      mission.title,
      mission.description,
      mission.banner_url,
      mission.status,
      mission.reward_e1xp,
      mission.starts_at,
      mission.ends_at,
      mission.config
    from public.missions mission
    where coalesce(mission.config->>'surface', '') = 'fandrop'
      and mission.status <> 'archived'
      and (
        input_slug is null
        or lower(mission.slug) = lower(input_slug)
      )
      and (
        mission.status not in ('draft', 'paused')
        or (
          input_profile_id is not null
          and coalesce(mission.config->>'creatorProfileId', '') = input_profile_id::text
        )
      )
    order by
      case
        when mission.ends_at is not null and mission.ends_at < current_utc_time then 1
        else 0
      end,
      coalesce(mission.ends_at, mission.starts_at, mission.created_at) desc
  loop
    tasks_json := '[]'::jsonb;
    completed_count := 0;
    required_completed_count := 0;
    required_task_count := 0;
    joined_at_value := null;
    participant_count := 0;
    rank_value := null;
    reward_sent_count := 0;
    reward_failed_count := 0;
    reward_pool_row := null;

    select *
    into reward_pool_row
    from public.fandrop_reward_pools pool
    where pool.mission_id = mission_row.id
    limit 1;

    if input_profile_id is not null then
      select participation.joined_at
      into joined_at_value
      from public.profile_fandrop_participation participation
      where participation.profile_id = input_profile_id
        and participation.campaign_slug = lower(mission_row.slug)
      limit 1;
    end if;

    select count(*)::integer
    into participant_count
    from public.profile_fandrop_participation participation
    where participation.campaign_slug = lower(mission_row.slug);

    if input_profile_id is not null and joined_at_value is not null then
      select 1 + count(*)::integer
      into rank_value
      from public.profile_fandrop_participation participation
      where participation.campaign_slug = lower(mission_row.slug)
        and (
          participation.joined_at < joined_at_value
          or (
            participation.joined_at = joined_at_value
            and participation.profile_id::text < input_profile_id::text
          )
        );
    elsif participant_count > 0 then
      rank_value := participant_count + 1;
    else
      rank_value := 1;
    end if;

    for task_row in
      select
        task.id,
        task.task_key,
        task.title,
        task.task_type,
        task.target_count,
        task.position,
        task.config
      from public.mission_tasks task
      where task.mission_id = mission_row.id
      order by task.position asc, task.created_at asc
    loop
      task_is_optional := coalesce((task_row.config->>'optional')::boolean, false);
      progress_label := null;
      current_value := 0;

      if input_profile_id is not null then
        if task_row.task_type = 'referral' then
          select count(*)::integer
          into current_value
          from public.referral_events event
          where event.referrer_id = input_profile_id
            and event.status in ('completed', 'rewarded')
            and (
              mission_row.starts_at is null
              or event.created_at >= mission_row.starts_at
            )
            and (
              mission_row.ends_at is null
              or event.created_at <= mission_row.ends_at
            );
        elsif task_row.task_type = 'payment' then
          minimum_amount := coalesce((task_row.config->>'minimumAmount')::numeric, 0);

          select count(*)::integer
          into current_value
          from public.payment_transactions payment
          where payment.profile_id = input_profile_id
            and payment.status = 'succeeded'
            and payment.amount >= minimum_amount
            and (
              mission_row.starts_at is null
              or payment.created_at >= mission_row.starts_at
            )
            and (
              mission_row.ends_at is null
              or payment.created_at <= mission_row.ends_at
            );
        elsif exists (
          select 1
          from public.profile_fandrop_participation participation
          where participation.profile_id = input_profile_id
            and participation.campaign_slug = lower(mission_row.slug)
        ) then
          current_value := 1;
        end if;
      end if;

      if current_value >= task_row.target_count then
        task_state := 'complete';
        completed_count := completed_count + 1;

        if not task_is_optional then
          required_completed_count := required_completed_count + 1;
        end if;
      elsif task_is_optional then
        task_state := 'optional';
      else
        task_state := 'todo';
      end if;

      if not task_is_optional then
        required_task_count := required_task_count + 1;
      end if;

      if task_row.task_type in ('payment', 'referral') then
        progress_label := format(
          '%s/%s',
          least(current_value, task_row.target_count),
          task_row.target_count
        );
      end if;

      tasks_json := tasks_json || jsonb_build_object(
        'id', task_row.id,
        'label', task_row.title,
        'progressLabel', progress_label,
        'state', task_state,
        'isOptional', task_is_optional,
        'currentValue', current_value,
        'targetValue', task_row.target_count
      );
    end loop;

    if mission_row.ends_at is not null and mission_row.ends_at <= current_utc_time then
      time_label := 'Ended';
    elsif mission_row.ends_at is null then
      time_label := 'Live';
    else
      diff_seconds := greatest(
        floor(extract(epoch from mission_row.ends_at - current_utc_time))::integer,
        0
      );

      if diff_seconds < 86400 then
        time_label := format('%sh', greatest(1, ceil(diff_seconds / 3600.0)::integer));
      else
        time_label := format('%sd', greatest(1, ceil(diff_seconds / 86400.0)::integer));
      end if;
    end if;

    if reward_pool_row.mission_id is not null then
      select
        count(*) filter (where distribution.status = 'sent')::integer,
        count(*) filter (where distribution.status = 'failed')::integer
      into reward_sent_count, reward_failed_count
      from public.fandrop_reward_distributions distribution
      where distribution.mission_id = mission_row.id;

      resolved_reward_pool_label := coalesce(
        mission_row.config->>'rewardPoolLabel',
        trim(to_char(reward_pool_row.reward_pool_amount, 'FM999999999999990.################')) || ' ' || reward_pool_row.reward_token_symbol
      );
    else
      resolved_reward_pool_label := mission_row.config->>'rewardPoolLabel';
    end if;

    result_json := result_json || jsonb_build_object(
      'id', mission_row.id,
      'missionId', mission_row.id,
      'slug', mission_row.slug,
      'title', mission_row.title,
      'subtitle', mission_row.description,
      'about', mission_row.config->>'about',
      'bannerUrl', mission_row.banner_url,
      'coverLabel', mission_row.config->>'coverLabel',
      'creatorHandle', mission_row.config->>'creatorHandle',
      'creatorName', mission_row.config->>'creatorName',
      'creatorProfileId', nullif(mission_row.config->>'creatorProfileId', ''),
      'ctaLabel',
        case
          when mission_row.ends_at is not null and mission_row.ends_at <= current_utc_time then 'View Results'
          when joined_at_value is not null and required_task_count > 0 and required_completed_count >= required_task_count then 'Completed'
          when joined_at_value is not null then 'Invite Friends'
          else 'Join FanDrop'
        end,
      'endsAt', mission_row.ends_at,
      'fundedAt', reward_pool_row.funded_at,
      'fundingTxHash', reward_pool_row.funding_tx_hash,
      'isJoined', joined_at_value is not null,
      'participantCount', participant_count,
      'progressComplete', completed_count,
      'progressTotal', jsonb_array_length(tasks_json),
      'rank', rank_value,
      'rankLabel', format('#%s', greatest(coalesce(rank_value, 1), 1)),
      'rewardE1xp', coalesce(mission_row.reward_e1xp, 0),
      'rewardPoolAmount', reward_pool_row.reward_pool_amount,
      'rewardPoolLabel', coalesce(resolved_reward_pool_label, 'Reward pool live'),
      'rewardSentCount', coalesce(reward_sent_count, 0),
      'rewardFailedCount', coalesce(reward_failed_count, 0),
      'rewardTokenAddress', reward_pool_row.reward_token_address,
      'rewardTokenDecimals', reward_pool_row.reward_token_decimals,
      'rewardTokenSymbol', reward_pool_row.reward_token_symbol,
      'settlementStatus', reward_pool_row.settlement_status,
      'startsAt', mission_row.starts_at,
      'status', mission_row.status,
      'state',
        case
          when mission_row.ends_at is not null and mission_row.ends_at <= current_utc_time then 'ended'
          when joined_at_value is not null and required_task_count > 0 and required_completed_count >= required_task_count then 'completed'
          when joined_at_value is not null then 'joined'
          else 'live'
        end,
      'tasks', tasks_json,
      'timeLabel', time_label,
      'winnerLimit', reward_pool_row.winner_limit
    );
  end loop;

  return result_json;
end;
$$;

grant execute on function public.upsert_profile_fandrop_campaign(uuid, uuid, text, text, text, text, text, text, integer, timestamptz, timestamptz, integer, numeric, boolean, public.mission_status, text, text, integer, numeric, integer) to anon, authenticated;
grant execute on function public.staff_upsert_fandrop_campaign(text, uuid, uuid, text, text, text, text, text, text, integer, timestamptz, timestamptz, integer, numeric, boolean, public.mission_status, text, text, integer, numeric, integer) to anon, authenticated;
grant execute on function public.list_staff_fandrops(text) to anon, authenticated;

comment on table public.fandrop_reward_pools is
  'Pre-funded ERC20 reward pool configuration for FanDrop campaigns, including funding and settlement lifecycle state.';

comment on table public.fandrop_reward_distributions is
  'Per-recipient FanDrop reward payout ledger used for automatic token transfers and winner notifications.';
