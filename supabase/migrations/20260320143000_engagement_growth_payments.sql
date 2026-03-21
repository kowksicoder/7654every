do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'social_target_kind'
  ) then
    create type public.social_target_kind as enum (
      'post',
      'comment',
      'creator_launch',
      'creator_collaboration',
      'community'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'share_channel'
  ) then
    create type public.share_channel as enum (
      'repost',
      'copy_link',
      'external',
      'quote'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'notification_kind'
  ) then
    create type public.notification_kind as enum (
      'like',
      'comment',
      'share',
      'referral',
      'mission',
      'reward',
      'streak',
      'payment',
      'system',
      'toast'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'referral_status'
  ) then
    create type public.referral_status as enum (
      'pending',
      'completed',
      'rewarded',
      'rejected',
      'expired'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'mission_status'
  ) then
    create type public.mission_status as enum (
      'draft',
      'active',
      'paused',
      'completed',
      'archived'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'mission_task_type'
  ) then
    create type public.mission_task_type as enum (
      'launch_creator',
      'like',
      'comment',
      'share',
      'referral',
      'community_join',
      'streak_check_in',
      'payment',
      'custom'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'mission_progress_status'
  ) then
    create type public.mission_progress_status as enum (
      'not_started',
      'in_progress',
      'completed',
      'claimed',
      'expired'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'reward_source_kind'
  ) then
    create type public.reward_source_kind as enum (
      'mission',
      'streak',
      'referral',
      'payment',
      'admin',
      'system',
      'manual_adjustment'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'streak_event_type'
  ) then
    create type public.streak_event_type as enum (
      'check_in',
      'mission',
      'launch',
      'referral',
      'community',
      'manual'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'toast_level'
  ) then
    create type public.toast_level as enum (
      'info',
      'success',
      'warning',
      'error'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'toast_audience'
  ) then
    create type public.toast_audience as enum (
      'all',
      'authenticated',
      'profile'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'payment_provider'
  ) then
    create type public.payment_provider as enum (
      'flutterwave'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'payment_status'
  ) then
    create type public.payment_status as enum (
      'pending',
      'initiated',
      'processing',
      'succeeded',
      'failed',
      'cancelled',
      'refunded'
    );
  end if;
end
$$;

create table if not exists public.content_comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  target_kind public.social_target_kind not null,
  target_key text not null,
  target_owner_id uuid references public.profiles (id) on delete set null,
  parent_comment_id uuid references public.content_comments (id) on delete cascade,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint content_comments_body_length check (
    char_length(trim(body)) between 1 and 2000
  )
);

create index if not exists content_comments_target_idx
  on public.content_comments (target_kind, target_key, created_at desc);

create index if not exists content_comments_author_idx
  on public.content_comments (author_id, created_at desc);

create index if not exists content_comments_parent_idx
  on public.content_comments (parent_comment_id, created_at asc)
  where parent_comment_id is not null;

create table if not exists public.content_likes (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  target_kind public.social_target_kind not null,
  target_key text not null,
  target_owner_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, target_kind, target_key)
);

create index if not exists content_likes_target_idx
  on public.content_likes (target_kind, target_key, created_at desc);

create table if not exists public.content_shares (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  target_kind public.social_target_kind not null,
  target_key text not null,
  target_owner_id uuid references public.profiles (id) on delete set null,
  channel public.share_channel not null default 'repost',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists content_shares_target_idx
  on public.content_shares (target_kind, target_key, created_at desc);

create index if not exists content_shares_profile_idx
  on public.content_shares (profile_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind public.notification_kind not null default 'system',
  title text not null,
  body text,
  target_kind public.social_target_kind,
  target_key text,
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notifications_title_length check (
    char_length(trim(title)) between 1 and 160
  )
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, is_read, created_at desc);

create index if not exists notifications_kind_idx
  on public.notifications (kind, created_at desc);

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  code text not null unique,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint referral_codes_code_format check (
    code ~ '^[A-Z0-9]{4,16}$'
  )
);

create index if not exists referral_codes_profile_idx
  on public.referral_codes (profile_id, is_active);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes (id) on delete restrict,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_profile_id uuid references public.profiles (id) on delete set null,
  referred_identifier text,
  source text not null default 'invite',
  status public.referral_status not null default 'pending',
  reward_e1xp integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint referral_events_reward_non_negative check (reward_e1xp >= 0)
);

create index if not exists referral_events_referrer_idx
  on public.referral_events (referrer_id, status, created_at desc);

create index if not exists referral_events_referred_profile_idx
  on public.referral_events (referred_profile_id, status, created_at desc)
  where referred_profile_id is not null;

create unique index if not exists referral_events_referred_profile_unique_idx
  on public.referral_events (referred_profile_id)
  where referred_profile_id is not null;

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  description text,
  banner_url text,
  icon_url text,
  status public.mission_status not null default 'draft',
  reward_e1xp integer not null default 0,
  is_repeatable boolean not null default false,
  max_claims_per_profile integer not null default 1,
  starts_at timestamptz,
  ends_at timestamptz,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint missions_slug_format check (
    slug ~ '^[a-z0-9-]{3,64}$'
  ),
  constraint missions_title_length check (
    char_length(trim(title)) between 1 and 120
  ),
  constraint missions_reward_non_negative check (reward_e1xp >= 0),
  constraint missions_max_claims_positive check (max_claims_per_profile >= 1)
);

create unique index if not exists missions_slug_unique_idx
  on public.missions (lower(slug));

create index if not exists missions_status_idx
  on public.missions (status, starts_at, ends_at);

create index if not exists missions_created_by_idx
  on public.missions (created_by, created_at desc)
  where created_by is not null;

create table if not exists public.mission_tasks (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  task_key text not null,
  title text not null,
  description text,
  task_type public.mission_task_type not null default 'custom',
  position integer not null default 0,
  target_count integer not null default 1,
  reward_e1xp integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint mission_tasks_task_key_format check (
    task_key ~ '^[a-z0-9-]{2,64}$'
  ),
  constraint mission_tasks_target_count_positive check (target_count >= 1),
  constraint mission_tasks_reward_non_negative check (reward_e1xp >= 0)
);

create unique index if not exists mission_tasks_mission_task_key_unique_idx
  on public.mission_tasks (mission_id, lower(task_key));

create index if not exists mission_tasks_mission_position_idx
  on public.mission_tasks (mission_id, position asc, created_at asc);

create table if not exists public.mission_task_progress (
  mission_task_id uuid not null references public.mission_tasks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.mission_progress_status not null default 'not_started',
  current_value integer not null default 0,
  target_value integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  last_activity_at timestamptz,
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (mission_task_id, profile_id),
  constraint mission_task_progress_current_non_negative check (current_value >= 0),
  constraint mission_task_progress_target_positive check (target_value >= 1)
);

create index if not exists mission_task_progress_profile_idx
  on public.mission_task_progress (profile_id, status, updated_at desc);

create table if not exists public.e1xp_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  source public.reward_source_kind not null,
  source_key text,
  amount integer not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint e1xp_ledger_amount_not_zero check (amount <> 0)
);

create index if not exists e1xp_ledger_profile_idx
  on public.e1xp_ledger (profile_id, created_at desc);

create table if not exists public.daily_streaks (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date,
  streak_freezes integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint daily_streaks_current_non_negative check (current_streak >= 0),
  constraint daily_streaks_longest_non_negative check (longest_streak >= 0),
  constraint daily_streaks_freezes_non_negative check (streak_freezes >= 0)
);

create table if not exists public.daily_streak_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  activity_date date not null,
  event_type public.streak_event_type not null default 'check_in',
  source_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists daily_streak_events_unique_idx
  on public.daily_streak_events (
    profile_id,
    activity_date,
    event_type,
    coalesce(source_key, '')
  );

create index if not exists daily_streak_events_profile_idx
  on public.daily_streak_events (profile_id, activity_date desc, created_at desc);

create table if not exists public.toast_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  level public.toast_level not null default 'info',
  audience public.toast_audience not null default 'all',
  target_profile_id uuid references public.profiles (id) on delete cascade,
  action_label text,
  action_url text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint toast_announcements_title_length check (
    char_length(trim(title)) between 1 and 120
  ),
  constraint toast_announcements_message_length check (
    char_length(trim(message)) between 1 and 500
  ),
  constraint toast_announcements_profile_target check (
    audience <> 'profile'
    or target_profile_id is not null
  )
);

create index if not exists toast_announcements_visibility_idx
  on public.toast_announcements (
    audience,
    is_active,
    starts_at,
    ends_at,
    created_at desc
  );

create table if not exists public.toast_dismissals (
  toast_id uuid not null references public.toast_announcements (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  dismissed_at timestamptz not null default timezone('utc', now()),
  primary key (toast_id, profile_id)
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  provider public.payment_provider not null default 'flutterwave',
  checkout_reference text not null,
  provider_transaction_id text,
  status public.payment_status not null default 'pending',
  currency text not null,
  amount numeric(20, 8) not null,
  fee_amount numeric(20, 8) not null default 0,
  purpose text not null default 'wallet_top_up',
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payment_transactions_currency_length check (
    char_length(trim(currency)) between 2 and 16
  ),
  constraint payment_transactions_amount_positive check (amount > 0),
  constraint payment_transactions_fee_non_negative check (fee_amount >= 0)
);

create unique index if not exists payment_transactions_checkout_reference_unique_idx
  on public.payment_transactions (checkout_reference);

create unique index if not exists payment_transactions_provider_tx_unique_idx
  on public.payment_transactions (provider, provider_transaction_id)
  where provider_transaction_id is not null;

create index if not exists payment_transactions_profile_idx
  on public.payment_transactions (profile_id, status, created_at desc);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null default 'flutterwave',
  provider_event_id text,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists payment_webhook_events_provider_event_unique_idx
  on public.payment_webhook_events (provider, provider_event_id)
  where provider_event_id is not null;

create or replace view public.content_engagement_rollups
with (security_invoker = true) as
with targets as (
  select distinct target_kind, target_key
  from (
    select like_item.target_kind, like_item.target_key
    from public.content_likes like_item
    union all
    select comment_item.target_kind, comment_item.target_key
    from public.content_comments comment_item
    where comment_item.is_deleted = false
    union all
    select share_item.target_kind, share_item.target_key
    from public.content_shares share_item
  ) all_targets
),
like_counts as (
  select
    target_kind,
    target_key,
    count(*)::bigint as like_count
  from public.content_likes
  group by target_kind, target_key
),
comment_counts as (
  select
    target_kind,
    target_key,
    count(*)::bigint as comment_count
  from public.content_comments
  where is_deleted = false
  group by target_kind, target_key
),
share_counts as (
  select
    target_kind,
    target_key,
    count(*)::bigint as share_count
  from public.content_shares
  group by target_kind, target_key
)
select
  targets.target_kind,
  targets.target_key,
  coalesce(like_counts.like_count, 0) as like_count,
  coalesce(comment_counts.comment_count, 0) as comment_count,
  coalesce(share_counts.share_count, 0) as share_count
from targets
left join like_counts
  on like_counts.target_kind = targets.target_kind
 and like_counts.target_key = targets.target_key
left join comment_counts
  on comment_counts.target_kind = targets.target_kind
 and comment_counts.target_key = targets.target_key
left join share_counts
  on share_counts.target_kind = targets.target_kind
 and share_counts.target_key = targets.target_key;

create or replace view public.profile_e1xp_balances
with (security_invoker = true) as
select
  ledger.profile_id,
  coalesce(sum(ledger.amount), 0)::bigint as total_e1xp,
  max(ledger.created_at) as last_reward_at
from public.e1xp_ledger ledger
group by ledger.profile_id;

create or replace function public.is_mission_owner(target_mission uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.missions mission
    where mission.id = target_mission
      and mission.created_by = auth.uid()
  );
$$;

create or replace function public.create_notification(
  input_recipient_id uuid,
  input_actor_id uuid,
  input_kind public.notification_kind,
  input_title text,
  input_body text default null,
  input_target_kind public.social_target_kind default null,
  input_target_key text default null,
  input_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_notification_id uuid;
begin
  insert into public.notifications (
    recipient_id,
    actor_id,
    kind,
    title,
    body,
    target_kind,
    target_key,
    data
  )
  values (
    input_recipient_id,
    input_actor_id,
    input_kind,
    input_title,
    input_body,
    input_target_kind,
    input_target_key,
    coalesce(input_data, '{}'::jsonb)
  )
  returning id into new_notification_id;

  return new_notification_id;
end;
$$;

create or replace function public.ensure_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_code text;
  candidate_code text;
begin
  if exists (
    select 1
    from public.referral_codes code
    where code.profile_id = new.id
  ) then
    return new;
  end if;

  base_code := upper(
    regexp_replace(
      coalesce(new.username, split_part(new.id::text, '-', 1)),
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
    candidate_code := left(base_code, 8)
      || upper(substr(encode(gen_random_bytes(2), 'hex'), 1, 4));
  end loop;

  insert into public.referral_codes (profile_id, code)
  values (new.id, candidate_code)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

create or replace function public.hydrate_referral_event_referrer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code_owner uuid;
begin
  select profile_id
  into code_owner
  from public.referral_codes code
  where code.id = new.referral_code_id;

  if code_owner is null then
    raise exception 'Referral code owner not found';
  end if;

  new.referrer_id := code_owner;
  return new;
end;
$$;

create or replace function public.notify_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_owner_id is null or new.target_owner_id = new.profile_id then
    return new;
  end if;

  perform public.create_notification(
    new.target_owner_id,
    new.profile_id,
    'like',
    'New like',
    'Someone liked your content.',
    new.target_kind,
    new.target_key,
    jsonb_build_object('channel', 'engagement')
  );

  return new;
end;
$$;

create or replace function public.notify_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
begin
  select parent_comment.author_id
  into recipient_id
  from public.content_comments parent_comment
  where parent_comment.id = new.parent_comment_id;

  recipient_id := coalesce(recipient_id, new.target_owner_id);

  if recipient_id is null or recipient_id = new.author_id then
    return new;
  end if;

  perform public.create_notification(
    recipient_id,
    new.author_id,
    'comment',
    'New comment',
    left(trim(new.body), 140),
    new.target_kind,
    new.target_key,
    jsonb_build_object(
      'comment_id',
      new.id,
      'is_reply',
      new.parent_comment_id is not null
    )
  );

  return new;
end;
$$;

create or replace function public.notify_share_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_owner_id is null or new.target_owner_id = new.profile_id then
    return new;
  end if;

  perform public.create_notification(
    new.target_owner_id,
    new.profile_id,
    'share',
    'New share',
    'Someone shared your content.',
    new.target_kind,
    new.target_key,
    jsonb_build_object('channel', new.channel)
  );

  return new;
end;
$$;

create or replace function public.notify_reward_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount <= 0 then
    return new;
  end if;

  perform public.create_notification(
    new.profile_id,
    null,
    'reward',
    'E1XP earned',
    format('You earned %s E1XP.', new.amount),
    null,
    new.source_key,
    jsonb_build_object(
      'source',
      new.source,
      'amount',
      new.amount
    )
  );

  return new;
end;
$$;

create or replace function public.notify_payment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_title text;
  notification_body text;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'succeeded' then
    notification_title := 'Payment completed';
    notification_body := 'Your Flutterwave payment succeeded.';
  elsif new.status in ('failed', 'cancelled', 'refunded') then
    notification_title := 'Payment updated';
    notification_body := format(
      'Your Flutterwave payment is now %s.',
      new.status
    );
  else
    return new;
  end if;

  perform public.create_notification(
    new.profile_id,
    null,
    'payment',
    notification_title,
    notification_body,
    null,
    new.checkout_reference,
    jsonb_build_object(
      'status',
      new.status,
      'provider',
      new.provider,
      'amount',
      new.amount,
      'currency',
      new.currency
    )
  );

  return new;
end;
$$;

drop trigger if exists content_comments_set_updated_at on public.content_comments;
create trigger content_comments_set_updated_at
  before update on public.content_comments
  for each row
  execute function public.set_updated_at();

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
  before update on public.notifications
  for each row
  execute function public.set_updated_at();

drop trigger if exists referral_codes_set_updated_at on public.referral_codes;
create trigger referral_codes_set_updated_at
  before update on public.referral_codes
  for each row
  execute function public.set_updated_at();

drop trigger if exists referral_events_set_updated_at on public.referral_events;
create trigger referral_events_set_updated_at
  before update on public.referral_events
  for each row
  execute function public.set_updated_at();

drop trigger if exists missions_set_updated_at on public.missions;
create trigger missions_set_updated_at
  before update on public.missions
  for each row
  execute function public.set_updated_at();

drop trigger if exists mission_tasks_set_updated_at on public.mission_tasks;
create trigger mission_tasks_set_updated_at
  before update on public.mission_tasks
  for each row
  execute function public.set_updated_at();

drop trigger if exists mission_task_progress_set_updated_at on public.mission_task_progress;
create trigger mission_task_progress_set_updated_at
  before update on public.mission_task_progress
  for each row
  execute function public.set_updated_at();

drop trigger if exists daily_streaks_set_updated_at on public.daily_streaks;
create trigger daily_streaks_set_updated_at
  before update on public.daily_streaks
  for each row
  execute function public.set_updated_at();

drop trigger if exists toast_announcements_set_updated_at on public.toast_announcements;
create trigger toast_announcements_set_updated_at
  before update on public.toast_announcements
  for each row
  execute function public.set_updated_at();

drop trigger if exists payment_transactions_set_updated_at on public.payment_transactions;
create trigger payment_transactions_set_updated_at
  before update on public.payment_transactions
  for each row
  execute function public.set_updated_at();

drop trigger if exists profiles_seed_referral_code on public.profiles;
create trigger profiles_seed_referral_code
  after insert on public.profiles
  for each row
  execute function public.ensure_referral_code();

drop trigger if exists referral_events_hydrate_referrer on public.referral_events;
create trigger referral_events_hydrate_referrer
  before insert or update on public.referral_events
  for each row
  execute function public.hydrate_referral_event_referrer();

drop trigger if exists content_likes_notify_owner on public.content_likes;
create trigger content_likes_notify_owner
  after insert on public.content_likes
  for each row
  execute function public.notify_like_insert();

drop trigger if exists content_comments_notify_owner on public.content_comments;
create trigger content_comments_notify_owner
  after insert on public.content_comments
  for each row
  execute function public.notify_comment_insert();

drop trigger if exists content_shares_notify_owner on public.content_shares;
create trigger content_shares_notify_owner
  after insert on public.content_shares
  for each row
  execute function public.notify_share_insert();

drop trigger if exists e1xp_ledger_notify_profile on public.e1xp_ledger;
create trigger e1xp_ledger_notify_profile
  after insert on public.e1xp_ledger
  for each row
  execute function public.notify_reward_insert();

drop trigger if exists payment_transactions_notify_status_change on public.payment_transactions;
create trigger payment_transactions_notify_status_change
  after update on public.payment_transactions
  for each row
  execute function public.notify_payment_update();

alter table public.content_comments enable row level security;
alter table public.content_likes enable row level security;
alter table public.content_shares enable row level security;
alter table public.notifications enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_events enable row level security;
alter table public.missions enable row level security;
alter table public.mission_tasks enable row level security;
alter table public.mission_task_progress enable row level security;
alter table public.e1xp_ledger enable row level security;
alter table public.daily_streaks enable row level security;
alter table public.daily_streak_events enable row level security;
alter table public.toast_announcements enable row level security;
alter table public.toast_dismissals enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;

drop policy if exists "content_comments_select_visible" on public.content_comments;
create policy "content_comments_select_visible"
  on public.content_comments
  for select
  using (is_deleted = false or auth.uid() = author_id);

drop policy if exists "content_comments_insert_author" on public.content_comments;
create policy "content_comments_insert_author"
  on public.content_comments
  for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "content_comments_update_author" on public.content_comments;
create policy "content_comments_update_author"
  on public.content_comments
  for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "content_comments_delete_author" on public.content_comments;
create policy "content_comments_delete_author"
  on public.content_comments
  for delete
  to authenticated
  using (auth.uid() = author_id);

drop policy if exists "content_likes_select_visible" on public.content_likes;
create policy "content_likes_select_visible"
  on public.content_likes
  for select
  using (true);

drop policy if exists "content_likes_insert_self" on public.content_likes;
create policy "content_likes_insert_self"
  on public.content_likes
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "content_likes_delete_self" on public.content_likes;
create policy "content_likes_delete_self"
  on public.content_likes
  for delete
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "content_shares_select_visible" on public.content_shares;
create policy "content_shares_select_visible"
  on public.content_shares
  for select
  using (true);

drop policy if exists "content_shares_insert_self" on public.content_shares;
create policy "content_shares_insert_self"
  on public.content_shares
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "content_shares_delete_self" on public.content_shares;
create policy "content_shares_delete_self"
  on public.content_shares
  for delete
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "notifications_select_recipient" on public.notifications;
create policy "notifications_select_recipient"
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = recipient_id);

drop policy if exists "notifications_update_recipient" on public.notifications;
create policy "notifications_update_recipient"
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

drop policy if exists "referral_codes_select_active" on public.referral_codes;
create policy "referral_codes_select_active"
  on public.referral_codes
  for select
  using (is_active = true or auth.uid() = profile_id);

drop policy if exists "referral_codes_insert_self" on public.referral_codes;
create policy "referral_codes_insert_self"
  on public.referral_codes
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "referral_codes_update_self" on public.referral_codes;
create policy "referral_codes_update_self"
  on public.referral_codes
  for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "referral_events_select_participants" on public.referral_events;
create policy "referral_events_select_participants"
  on public.referral_events
  for select
  to authenticated
  using (
    auth.uid() = referrer_id
    or auth.uid() = referred_profile_id
  );

drop policy if exists "referral_events_insert_referrer" on public.referral_events;
create policy "referral_events_insert_referrer"
  on public.referral_events
  for insert
  to authenticated
  with check (auth.uid() = referrer_id);

drop policy if exists "missions_select_visible" on public.missions;
create policy "missions_select_visible"
  on public.missions
  for select
  using (
    status = 'active'
    or auth.uid() = created_by
  );

drop policy if exists "missions_insert_owner" on public.missions;
create policy "missions_insert_owner"
  on public.missions
  for insert
  to authenticated
  with check (
    created_by is not null
    and auth.uid() = created_by
  );

drop policy if exists "missions_update_owner" on public.missions;
create policy "missions_update_owner"
  on public.missions
  for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "missions_delete_owner" on public.missions;
create policy "missions_delete_owner"
  on public.missions
  for delete
  to authenticated
  using (auth.uid() = created_by);

drop policy if exists "mission_tasks_select_visible" on public.mission_tasks;
create policy "mission_tasks_select_visible"
  on public.mission_tasks
  for select
  using (
    exists (
      select 1
      from public.missions mission
      where mission.id = mission_id
        and (
          mission.status = 'active'
          or mission.created_by = auth.uid()
        )
    )
  );

drop policy if exists "mission_tasks_insert_owner" on public.mission_tasks;
create policy "mission_tasks_insert_owner"
  on public.mission_tasks
  for insert
  to authenticated
  with check (public.is_mission_owner(mission_id));

drop policy if exists "mission_tasks_update_owner" on public.mission_tasks;
create policy "mission_tasks_update_owner"
  on public.mission_tasks
  for update
  to authenticated
  using (public.is_mission_owner(mission_id))
  with check (public.is_mission_owner(mission_id));

drop policy if exists "mission_tasks_delete_owner" on public.mission_tasks;
create policy "mission_tasks_delete_owner"
  on public.mission_tasks
  for delete
  to authenticated
  using (public.is_mission_owner(mission_id));

drop policy if exists "mission_task_progress_select_self" on public.mission_task_progress;
create policy "mission_task_progress_select_self"
  on public.mission_task_progress
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "e1xp_ledger_select_self" on public.e1xp_ledger;
create policy "e1xp_ledger_select_self"
  on public.e1xp_ledger
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "daily_streaks_select_self" on public.daily_streaks;
create policy "daily_streaks_select_self"
  on public.daily_streaks
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "daily_streak_events_select_self" on public.daily_streak_events;
create policy "daily_streak_events_select_self"
  on public.daily_streak_events
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "toast_announcements_select_visible" on public.toast_announcements;
create policy "toast_announcements_select_visible"
  on public.toast_announcements
  for select
  using (
    is_active = true
    and (starts_at is null or starts_at <= timezone('utc', now()))
    and (ends_at is null or ends_at >= timezone('utc', now()))
    and (
      audience = 'all'
      or (audience = 'authenticated' and auth.uid() is not null)
      or (audience = 'profile' and target_profile_id = auth.uid())
      or created_by = auth.uid()
    )
  );

drop policy if exists "toast_announcements_insert_owner" on public.toast_announcements;
create policy "toast_announcements_insert_owner"
  on public.toast_announcements
  for insert
  to authenticated
  with check (
    created_by is not null
    and auth.uid() = created_by
  );

drop policy if exists "toast_announcements_update_owner" on public.toast_announcements;
create policy "toast_announcements_update_owner"
  on public.toast_announcements
  for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "toast_announcements_delete_owner" on public.toast_announcements;
create policy "toast_announcements_delete_owner"
  on public.toast_announcements
  for delete
  to authenticated
  using (auth.uid() = created_by);

drop policy if exists "toast_dismissals_select_self" on public.toast_dismissals;
create policy "toast_dismissals_select_self"
  on public.toast_dismissals
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "toast_dismissals_insert_self" on public.toast_dismissals;
create policy "toast_dismissals_insert_self"
  on public.toast_dismissals
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "toast_dismissals_delete_self" on public.toast_dismissals;
create policy "toast_dismissals_delete_self"
  on public.toast_dismissals
  for delete
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "payment_transactions_select_self" on public.payment_transactions;
create policy "payment_transactions_select_self"
  on public.payment_transactions
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "payment_transactions_insert_self" on public.payment_transactions;
create policy "payment_transactions_insert_self"
  on public.payment_transactions
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

grant select on public.content_comments to anon, authenticated;
grant insert, update, delete on public.content_comments to authenticated;

grant select on public.content_likes to anon, authenticated;
grant insert, delete on public.content_likes to authenticated;

grant select on public.content_shares to anon, authenticated;
grant insert, delete on public.content_shares to authenticated;

grant select, update on public.notifications to authenticated;

grant select on public.referral_codes to anon, authenticated;
grant insert, update on public.referral_codes to authenticated;

grant select on public.referral_events to authenticated;
grant insert on public.referral_events to authenticated;

grant select on public.missions to anon, authenticated;
grant insert, update, delete on public.missions to authenticated;

grant select on public.mission_tasks to anon, authenticated;
grant insert, update, delete on public.mission_tasks to authenticated;

grant select on public.mission_task_progress to authenticated;

grant select on public.e1xp_ledger to authenticated;
grant select on public.profile_e1xp_balances to authenticated;

grant select on public.daily_streaks to authenticated;
grant select on public.daily_streak_events to authenticated;

grant select on public.toast_announcements to anon, authenticated;
grant insert, update, delete on public.toast_announcements to authenticated;

grant select on public.toast_dismissals to authenticated;
grant insert, delete on public.toast_dismissals to authenticated;

grant select on public.payment_transactions to authenticated;
grant insert on public.payment_transactions to authenticated;

grant select on public.content_engagement_rollups to anon, authenticated;

comment on table public.content_comments is
  'Off-chain comment records for Every1 social surfaces, including replies and creator content threads.';

comment on table public.content_likes is
  'Off-chain like records keyed to a generic content target so likes can attach to posts, launches, and future surfaces.';

comment on table public.content_shares is
  'Off-chain share and repost events for public engagement counters and downstream notifications.';

comment on table public.notifications is
  'In-app notification inbox for engagement, rewards, referrals, streaks, payments, and future platform alerts.';

comment on table public.referral_codes is
  'Public referral identities for Every1 users, generated automatically from profile creation.';

comment on table public.referral_events is
  'Referral lifecycle events that can later award E1XP, unlock missions, and drive growth dashboards.';

comment on table public.missions is
  'Mission and campaign headers for off-chain quests, incentive programs, and creator growth programs.';

comment on table public.mission_tasks is
  'Task-level mission definitions so a mission can contain multiple steps such as like, share, referral, or payment actions.';

comment on table public.mission_task_progress is
  'Per-user mission task progress snapshots that can later power claim buttons, progress bars, and mission completion logic.';

comment on table public.e1xp_ledger is
  'Immutable E1XP reward ledger for mission payouts, streak bonuses, referrals, payment incentives, and manual adjustments.';

comment on view public.profile_e1xp_balances is
  'Security-invoker view that rolls the E1XP ledger into per-profile balances for the authenticated user.';

comment on table public.daily_streaks is
  'Per-user streak summary state for current streak, longest streak, and available freezes.';

comment on table public.daily_streak_events is
  'Granular daily streak check-ins and qualifying activity events used to compute streak history and calendars.';

comment on table public.toast_announcements is
  'Platform toast campaigns for lightweight alerts, launch nudges, reward notices, and targeted callouts.';

comment on table public.toast_dismissals is
  'Per-user dismissal records so the app can hide already-dismissed toast announcements.';

comment on table public.payment_transactions is
  'Flutterwave-backed payment transaction records for off-chain checkout, verification, and payout visibility.';

comment on table public.payment_webhook_events is
  'Raw payment webhook audit log for Flutterwave event processing and reconciliation.';

comment on view public.content_engagement_rollups is
  'Aggregated like, comment, and share counters for a generic content target.';
