create table if not exists public.profile_fandrop_notification_deliveries (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  campaign_slug text not null,
  campaign_title text not null,
  creator_name text,
  reward_pool_label text,
  delivered_at timestamptz not null default timezone('utc', now()),
  notification_id uuid references public.notifications (id) on delete set null,
  primary key (profile_id, campaign_slug)
);

create table if not exists public.profile_fandrop_participation (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  campaign_slug text not null,
  campaign_title text not null,
  creator_name text,
  reward_pool_label text,
  joined_at timestamptz not null default timezone('utc', now()),
  notification_id uuid references public.notifications (id) on delete set null,
  primary key (profile_id, campaign_slug)
);

create or replace function public.sync_profile_fandrop_notifications(
  input_profile_id uuid,
  input_campaigns jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign jsonb;
  campaign_slug text;
  campaign_state text;
  campaign_title text;
  creator_name text;
  reward_pool_label text;
  created_count integer := 0;
  created_notification_id uuid;
  delivered_campaign_slugs jsonb := '[]'::jsonb;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  if jsonb_typeof(coalesce(input_campaigns, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object(
      'createdCount',
      0,
      'deliveredCampaignSlugs',
      '[]'::jsonb
    );
  end if;

  for campaign in
    select value
    from jsonb_array_elements(coalesce(input_campaigns, '[]'::jsonb))
  loop
    campaign_slug := lower(trim(coalesce(campaign->>'slug', '')));
    campaign_state := lower(trim(coalesce(campaign->>'state', 'live')));
    campaign_title := nullif(trim(coalesce(campaign->>'title', '')), '');
    creator_name := nullif(trim(coalesce(campaign->>'creatorName', '')), '');
    reward_pool_label := nullif(trim(coalesce(campaign->>'rewardPoolLabel', '')), '');

    if campaign_slug = '' or campaign_title is null or campaign_state = 'ended' then
      continue;
    end if;

    insert into public.profile_fandrop_notification_deliveries (
      profile_id,
      campaign_slug,
      campaign_title,
      creator_name,
      reward_pool_label
    )
    values (
      input_profile_id,
      campaign_slug,
      campaign_title,
      creator_name,
      reward_pool_label
    )
    on conflict (profile_id, campaign_slug) do nothing;

    if found then
      created_notification_id := public.create_notification(
        input_profile_id,
        null,
        'mission',
        format('New FanDrop live: %s', campaign_title),
        format(
          '%s just opened a FanDrop with %s up for grabs. Jump in before the window closes.',
          coalesce(creator_name, 'A creator'),
          coalesce(reward_pool_label, 'a live reward pool')
        ),
        null,
        format('fandrop:%s', campaign_slug),
        jsonb_build_object(
          'creatorName',
          creator_name,
          'deliveryKind',
          'fandrop_new',
          'rewardPoolLabel',
          reward_pool_label,
          'slug',
          campaign_slug,
          'title',
          campaign_title
        )
      );

      update public.profile_fandrop_notification_deliveries delivery
      set notification_id = created_notification_id
      where delivery.profile_id = input_profile_id
        and delivery.campaign_slug = campaign_slug;

      created_count := created_count + 1;
      delivered_campaign_slugs := delivered_campaign_slugs || to_jsonb(campaign_slug);
    end if;
  end loop;

  return jsonb_build_object(
    'createdCount',
    created_count,
    'deliveredCampaignSlugs',
    delivered_campaign_slugs
  );
end;
$$;

create or replace function public.join_fandrop_campaign(
  input_profile_id uuid,
  input_campaign_slug text,
  input_campaign_title text,
  input_creator_name text default null,
  input_reward_pool_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_slug text := lower(trim(coalesce(input_campaign_slug, '')));
  normalized_title text := nullif(trim(coalesce(input_campaign_title, '')), '');
  normalized_creator_name text := nullif(trim(coalesce(input_creator_name, '')), '');
  normalized_reward_pool_label text := nullif(trim(coalesce(input_reward_pool_label, '')), '');
  created_notification_id uuid;
  joined_at_value timestamptz;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  if normalized_slug = '' then
    raise exception 'campaign_slug is required';
  end if;

  if normalized_title is null then
    raise exception 'campaign_title is required';
  end if;

  insert into public.profile_fandrop_participation (
    profile_id,
    campaign_slug,
    campaign_title,
    creator_name,
    reward_pool_label
  )
  values (
    input_profile_id,
    normalized_slug,
    normalized_title,
    normalized_creator_name,
    normalized_reward_pool_label
  )
  on conflict (profile_id, campaign_slug) do nothing
  returning joined_at into joined_at_value;

  if joined_at_value is null then
    select participation.joined_at
    into joined_at_value
    from public.profile_fandrop_participation participation
    where participation.profile_id = input_profile_id
      and participation.campaign_slug = normalized_slug;

    return jsonb_build_object(
      'joined',
      false,
      'alreadyJoined',
      true,
      'campaignSlug',
      normalized_slug,
      'joinedAt',
      joined_at_value,
      'reason',
      'You already joined this FanDrop.'
    );
  end if;

  created_notification_id := public.create_notification(
    input_profile_id,
    null,
    'mission',
    format('Joined FanDrop: %s', normalized_title),
    format(
      'You are in %s. Hold your spot and push toward %s before the window closes.',
      normalized_title,
      coalesce(normalized_reward_pool_label, 'the reward pool')
    ),
    null,
    format('fandrop:%s', normalized_slug),
    jsonb_build_object(
      'creatorName',
      normalized_creator_name,
      'deliveryKind',
      'fandrop_joined',
      'rewardPoolLabel',
      normalized_reward_pool_label,
      'slug',
      normalized_slug,
      'title',
      normalized_title
    )
  );

  update public.profile_fandrop_participation participation
  set notification_id = created_notification_id
  where participation.profile_id = input_profile_id
    and participation.campaign_slug = normalized_slug;

  return jsonb_build_object(
    'joined',
    true,
    'alreadyJoined',
    false,
    'campaignSlug',
    normalized_slug,
    'joinedAt',
    joined_at_value,
    'notificationId',
    created_notification_id
  );
end;
$$;

create or replace function public.list_profile_fandrop_participation(
  input_profile_id uuid
)
returns table (
  campaign_slug text,
  joined_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    participation.campaign_slug,
    participation.joined_at
  from public.profile_fandrop_participation participation
  where participation.profile_id = input_profile_id
  order by participation.joined_at desc;
$$;

create or replace function public.claim_mission_reward(
  input_profile_id uuid,
  input_mission_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mission_row public.missions%rowtype;
  reward_e1xp integer := 0;
  all_tasks_completed boolean := false;
  already_claimed boolean := false;
  notification_id uuid;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  if input_mission_id is null then
    raise exception 'mission_id is required';
  end if;

  perform public.ensure_default_streak_missions();

  select *
  into mission_row
  from public.missions mission
  where mission.id = input_mission_id;

  if mission_row.id is null then
    raise exception 'mission not found';
  end if;

  select bool_and(
    coalesce(progress.status, 'not_started'::public.mission_progress_status) in ('completed', 'claimed')
  )
  into all_tasks_completed
  from public.mission_tasks task
  left join public.mission_task_progress progress
    on progress.mission_task_id = task.id
   and progress.profile_id = input_profile_id
  where task.mission_id = input_mission_id;

  if coalesce(all_tasks_completed, false) = false then
    return jsonb_build_object(
      'claimed',
      false,
      'alreadyClaimed',
      false,
      'missionId',
      input_mission_id,
      'reason',
      'Mission is not complete yet.'
    );
  end if;

  select bool_and(progress.status = 'claimed')
  into already_claimed
  from public.mission_tasks task
  join public.mission_task_progress progress
    on progress.mission_task_id = task.id
   and progress.profile_id = input_profile_id
  where task.mission_id = input_mission_id;

  if coalesce(already_claimed, false) then
    return jsonb_build_object(
      'claimed',
      false,
      'alreadyClaimed',
      true,
      'missionId',
      input_mission_id,
      'reason',
      'Mission reward already claimed.'
    );
  end if;

  reward_e1xp := coalesce(
    nullif(mission_row.reward_e1xp, 0),
    (
      select coalesce(sum(task.reward_e1xp), 0)
      from public.mission_tasks task
      where task.mission_id = input_mission_id
    ),
    0
  );

  update public.mission_task_progress progress
  set
    status = 'claimed',
    current_value = greatest(progress.current_value, progress.target_value),
    claimed_at = coalesce(progress.claimed_at, timezone('utc', now())),
    completed_at = coalesce(progress.completed_at, timezone('utc', now())),
    last_activity_at = timezone('utc', now()),
    metadata = coalesce(progress.metadata, '{}'::jsonb) || jsonb_build_object(
      'claimed_via',
      'streak-page'
    )
  where progress.profile_id = input_profile_id
    and progress.mission_task_id in (
      select task.id
      from public.mission_tasks task
      where task.mission_id = input_mission_id
    );

  if reward_e1xp > 0 then
    insert into public.e1xp_ledger (
      profile_id,
      source,
      source_key,
      amount,
      description,
      metadata
    )
    values (
      input_profile_id,
      'mission',
      format('mission:%s', input_mission_id),
      reward_e1xp,
      format('Mission reward claimed: %s', mission_row.title),
      jsonb_build_object(
        'mission_id',
        mission_row.id,
        'mission_slug',
        mission_row.slug,
        'surface',
        'streaks'
      )
    );

    notification_id := public.create_notification(
      input_profile_id,
      null,
      'reward',
      format('Reward claimed: %s', mission_row.title),
      format('+%s E1XP just landed in your balance.', reward_e1xp),
      null,
      format('mission:%s', input_mission_id),
      jsonb_build_object(
        'deliveryKind',
        'mission_reward',
        'mission_id',
        mission_row.id,
        'mission_slug',
        mission_row.slug,
        'mission_title',
        mission_row.title,
        'reward_e1xp',
        reward_e1xp
      )
    );
  end if;

  return jsonb_build_object(
    'claimed',
    true,
    'alreadyClaimed',
    false,
    'missionId',
    input_mission_id,
    'missionTitle',
    mission_row.title,
    'notificationId',
    notification_id,
    'rewardE1xp',
    reward_e1xp
  );
end;
$$;

grant execute on function public.sync_profile_fandrop_notifications(uuid, jsonb) to anon, authenticated;
grant execute on function public.join_fandrop_campaign(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.list_profile_fandrop_participation(uuid) to anon, authenticated;
