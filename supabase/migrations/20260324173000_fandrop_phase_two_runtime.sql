create or replace function public.__upsert_fandrop_mission(
  input_slug text,
  input_title text,
  input_subtitle text,
  input_banner_url text,
  input_reward_e1xp integer,
  input_starts_at timestamptz,
  input_ends_at timestamptz,
  input_status public.mission_status,
  input_config jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_mission_id uuid;
begin
  select mission.id
  into existing_mission_id
  from public.missions mission
  where lower(mission.slug) = lower(input_slug)
  limit 1;

  if existing_mission_id is null then
    insert into public.missions (
      slug,
      title,
      description,
      banner_url,
      status,
      reward_e1xp,
      starts_at,
      ends_at,
      config
    )
    values (
      lower(trim(input_slug)),
      input_title,
      input_subtitle,
      input_banner_url,
      input_status,
      coalesce(input_reward_e1xp, 0),
      input_starts_at,
      input_ends_at,
      coalesce(input_config, '{}'::jsonb)
    )
    returning id into existing_mission_id;
  else
    update public.missions
    set
      title = input_title,
      description = input_subtitle,
      banner_url = input_banner_url,
      status = input_status,
      reward_e1xp = coalesce(input_reward_e1xp, 0),
      starts_at = input_starts_at,
      ends_at = input_ends_at,
      config = coalesce(config, '{}'::jsonb) || coalesce(input_config, '{}'::jsonb)
    where id = existing_mission_id;
  end if;

  return existing_mission_id;
end;
$$;

create or replace function public.__upsert_fandrop_task(
  input_mission_id uuid,
  input_task_key text,
  input_title text,
  input_description text,
  input_task_type public.mission_task_type,
  input_position integer,
  input_target_count integer,
  input_reward_e1xp integer,
  input_config jsonb
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
    and lower(task.task_key) = lower(input_task_key)
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
      lower(trim(input_task_key)),
      input_title,
      input_description,
      input_task_type,
      coalesce(input_position, 0),
      greatest(coalesce(input_target_count, 1), 1),
      coalesce(input_reward_e1xp, 0),
      coalesce(input_config, '{}'::jsonb)
    )
    returning id into existing_task_id;
  else
    update public.mission_tasks
    set
      title = input_title,
      description = input_description,
      task_type = input_task_type,
      position = coalesce(input_position, 0),
      target_count = greatest(coalesce(input_target_count, 1), 1),
      reward_e1xp = coalesce(input_reward_e1xp, 0),
      config = coalesce(config, '{}'::jsonb) || coalesce(input_config, '{}'::jsonb)
    where id = existing_task_id;
  end if;

  return existing_task_id;
end;
$$;

do $$
declare
  now_utc timestamptz := timezone('utc', now());
  mission_id uuid;
begin
  mission_id := public.__upsert_fandrop_mission(
    'asake-fandrop',
    'Asake FanDrop',
    'Earn rewards before the drop lands.',
    '/buycoin.png',
    320,
    now_utc - interval '2 hours',
    now_utc + interval '12 hours',
    'active',
    jsonb_build_object(
      'about', 'Asake is opening an early fan run for his next drop. Join the circle, bring your people, and lock in your spot before rewards settle.',
      'coverLabel', 'Street pop',
      'creatorHandle', '@asakemusic',
      'creatorName', 'Asake',
      'rewardPoolLabel', '5,000 ASAKE',
      'surface', 'fandrop'
    )
  );
  perform public.__upsert_fandrop_task(mission_id, 'join', 'Join', 'Join the FanDrop to hold your lane.', 'custom', 0, 1, 0, jsonb_build_object('action', 'join'));
  perform public.__upsert_fandrop_task(mission_id, 'invite-circle', 'Invite 2 friends', 'Invite two new supporters into Every1.', 'referral', 1, 2, 0, '{}'::jsonb);
  perform public.__upsert_fandrop_task(mission_id, 'buy-500', 'Buy N500 (optional)', 'Top up or spend at least N500 during the FanDrop window.', 'payment', 2, 1, 0, jsonb_build_object('minimumAmount', 500, 'optional', true));

  mission_id := public.__upsert_fandrop_mission(
    'ayra-circle-sprint',
    'Ayra Circle Sprint',
    'You are in. Push one more step for bonus rewards.',
    '/buycoin.png',
    280,
    now_utc - interval '1 hour',
    now_utc + interval '10 hours',
    'active',
    jsonb_build_object(
      'about', 'Ayra''s core fan circle is running a referral sprint. Bring in new supporters, finish the final step, and climb the reward board before close.',
      'coverLabel', 'Core fans',
      'creatorHandle', '@ayrastarr',
      'creatorName', 'Ayra Starr',
      'rewardPoolLabel', '3,200 AYRA',
      'surface', 'fandrop'
    )
  );
  perform public.__upsert_fandrop_task(mission_id, 'join', 'Join', 'Lock your place in the sprint.', 'custom', 0, 1, 0, jsonb_build_object('action', 'join'));
  perform public.__upsert_fandrop_task(mission_id, 'invite-circle', 'Invite 2 friends', 'Bring in two new supporters before close.', 'referral', 1, 2, 0, '{}'::jsonb);
  perform public.__upsert_fandrop_task(mission_id, 'buy-500', 'Buy N500 (optional)', 'Support the sprint with an optional N500 top-up.', 'payment', 2, 1, 0, jsonb_build_object('minimumAmount', 500, 'optional', true));

  mission_id := public.__upsert_fandrop_mission(
    'burna-reward-wave',
    'Burna Reward Wave',
    'Rewards are pending while the pool settles.',
    '/buycoin.png',
    450,
    now_utc - interval '2 hours',
    now_utc + interval '4 hours',
    'active',
    jsonb_build_object(
      'about', 'Burna''s drop queue is almost settled. You already cleared the actions, so this page becomes your holding screen until distribution completes.',
      'coverLabel', 'Reward queue',
      'creatorHandle', '@burnaboy',
      'creatorName', 'Burna Boy',
      'rewardPoolLabel', '8,000 BURNA',
      'surface', 'fandrop'
    )
  );
  perform public.__upsert_fandrop_task(mission_id, 'join', 'Join', 'Enter the reward queue.', 'custom', 0, 1, 0, jsonb_build_object('action', 'join'));
  perform public.__upsert_fandrop_task(mission_id, 'invite-circle', 'Invite 2 friends', 'Invite two supporters into the wave.', 'referral', 1, 2, 0, '{}'::jsonb);
  perform public.__upsert_fandrop_task(mission_id, 'buy-500', 'Buy N500 (optional)', 'Optional purchase boost before settlement.', 'payment', 2, 1, 0, jsonb_build_object('minimumAmount', 500, 'optional', true));

  mission_id := public.__upsert_fandrop_mission(
    'unilag-campus-rally',
    'UNILAG Campus Rally',
    'The campaign ended and final results are now locked.',
    '/buycoin.png',
    190,
    now_utc - interval '2 days',
    now_utc - interval '2 hours',
    'completed',
    jsonb_build_object(
      'about', 'UNILAG Creators ran a campus FanDrop for members who showed up early, invited builders, and supported the coin before the window closed.',
      'coverLabel', 'Campus',
      'creatorHandle', '@unilagcreators',
      'creatorName', 'UNILAG Creators',
      'rewardPoolLabel', '2,400 UNILAG',
      'surface', 'fandrop'
    )
  );
  perform public.__upsert_fandrop_task(mission_id, 'join', 'Join', 'Lock in the rally lane.', 'custom', 0, 1, 0, jsonb_build_object('action', 'join'));
  perform public.__upsert_fandrop_task(mission_id, 'invite-circle', 'Invite 2 friends', 'Bring two friends into the rally.', 'referral', 1, 2, 0, '{}'::jsonb);
  perform public.__upsert_fandrop_task(mission_id, 'buy-500', 'Buy N500 (optional)', 'Optional campus support action.', 'payment', 2, 1, 0, jsonb_build_object('minimumAmount', 500, 'optional', true));

  mission_id := public.__upsert_fandrop_mission(
    'culture-plug-rush',
    'Culture Plug Rush',
    'One final action stands between you and the payout lane.',
    '/buycoin.png',
    260,
    now_utc - interval '3 hours',
    now_utc + interval '6 hours',
    'active',
    jsonb_build_object(
      'about', 'A fast-moving creators-only FanDrop aimed at culture accounts, meme pages, and trend spotters who move early and keep engagement hot.',
      'coverLabel', 'Culture',
      'creatorHandle', '@cultureplug',
      'creatorName', 'Culture Plug',
      'rewardPoolLabel', '4,500 PLUG',
      'surface', 'fandrop'
    )
  );
  perform public.__upsert_fandrop_task(mission_id, 'join', 'Join', 'Enter the culture rush.', 'custom', 0, 1, 0, jsonb_build_object('action', 'join'));
  perform public.__upsert_fandrop_task(mission_id, 'invite-circle', 'Invite 2 friends', 'Bring in two more early supporters.', 'referral', 1, 2, 0, '{}'::jsonb);
  perform public.__upsert_fandrop_task(mission_id, 'buy-500', 'Buy N500', 'Complete the final purchase step.', 'payment', 2, 1, 0, jsonb_build_object('minimumAmount', 500));

  mission_id := public.__upsert_fandrop_mission(
    'creator-week-spotlight',
    'Creator Week Spotlight',
    'Step in early and fight for a higher FanDrop rank.',
    '/buycoin.png',
    340,
    now_utc - interval '1 hour',
    now_utc + interval '18 hours',
    'active',
    jsonb_build_object(
      'about', 'A creator-week FanDrop spotlight for fans who enter early, invite their circle, and stay ready before the final leaderboard lock.',
      'coverLabel', 'Spotlight',
      'creatorHandle', '@jessepollak',
      'creatorName', 'Jesse Pollak',
      'rewardPoolLabel', '6,000 BASE',
      'surface', 'fandrop'
    )
  );
  perform public.__upsert_fandrop_task(mission_id, 'join', 'Join', 'Step into the spotlight lane.', 'custom', 0, 1, 0, jsonb_build_object('action', 'join'));
  perform public.__upsert_fandrop_task(mission_id, 'invite-circle', 'Invite 2 friends', 'Invite two people before the leaderboard locks.', 'referral', 1, 2, 0, '{}'::jsonb);
  perform public.__upsert_fandrop_task(mission_id, 'buy-500', 'Buy N500 (optional)', 'Optional boost for the spotlight pool.', 'payment', 2, 1, 0, jsonb_build_object('minimumAmount', 500, 'optional', true));
end
$$;

drop function public.__upsert_fandrop_task(uuid, text, text, text, public.mission_task_type, integer, integer, integer, jsonb);
drop function public.__upsert_fandrop_mission(text, text, text, text, integer, timestamptz, timestamptz, public.mission_status, jsonb);

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
      and (
        input_slug is null
        or lower(mission.slug) = lower(input_slug)
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
      'ctaLabel',
        case
          when mission_row.ends_at is not null and mission_row.ends_at <= current_utc_time then 'View Results'
          when joined_at_value is not null and required_task_count > 0 and required_completed_count >= required_task_count then 'Completed'
          when joined_at_value is not null then 'Invite Friends'
          else 'Join FanDrop'
        end,
      'endsAt', mission_row.ends_at,
      'isJoined', joined_at_value is not null,
      'participantCount', participant_count,
      'progressComplete', completed_count,
      'progressTotal', jsonb_array_length(tasks_json),
      'rank', rank_value,
      'rankLabel', format('#%s', greatest(coalesce(rank_value, 1), 1)),
      'rewardE1xp', coalesce(mission_row.reward_e1xp, 0),
      'rewardPoolLabel', mission_row.config->>'rewardPoolLabel',
      'startsAt', mission_row.starts_at,
      'state',
        case
          when mission_row.ends_at is not null and mission_row.ends_at <= current_utc_time then 'ended'
          when joined_at_value is not null and required_task_count > 0 and required_completed_count >= required_task_count then 'completed'
          when joined_at_value is not null then 'joined'
          else 'live'
        end,
      'tasks', tasks_json,
      'timeLabel', time_label
    );
  end loop;

  return result_json;
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
  mission_id uuid;
  join_task_id uuid;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  if normalized_slug = '' then
    raise exception 'campaign_slug is required';
  end if;

  select mission.id
  into mission_id
  from public.missions mission
  where lower(mission.slug) = normalized_slug
    and coalesce(mission.config->>'surface', '') = 'fandrop'
  limit 1;

  if mission_id is null then
    raise exception 'FanDrop campaign not found.';
  end if;

  if normalized_title is null then
    select mission.title
    into normalized_title
    from public.missions mission
    where mission.id = mission_id;
  end if;

  if normalized_creator_name is null then
    select nullif(mission.config->>'creatorName', '')
    into normalized_creator_name
    from public.missions mission
    where mission.id = mission_id;
  end if;

  if normalized_reward_pool_label is null then
    select nullif(mission.config->>'rewardPoolLabel', '')
    into normalized_reward_pool_label
    from public.missions mission
    where mission.id = mission_id;
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
      'joined', false,
      'alreadyJoined', true,
      'campaignSlug', normalized_slug,
      'joinedAt', joined_at_value,
      'reason', 'You already joined this FanDrop.'
    );
  end if;

  select task.id
  into join_task_id
  from public.mission_tasks task
  where task.mission_id = mission_id
    and lower(task.task_key) = 'join'
  limit 1;

  if join_task_id is not null then
    insert into public.mission_task_progress (
      mission_task_id,
      profile_id,
      status,
      current_value,
      target_value,
      metadata,
      last_activity_at,
      completed_at
    )
    values (
      join_task_id,
      input_profile_id,
      'completed',
      1,
      1,
      jsonb_build_object('surface', 'fandrop', 'joined_via', 'fandrop'),
      timezone('utc', now()),
      timezone('utc', now())
    )
    on conflict (mission_task_id, profile_id) do update
    set
      status = 'completed',
      current_value = 1,
      target_value = 1,
      metadata = coalesce(mission_task_progress.metadata, '{}'::jsonb) || jsonb_build_object('surface', 'fandrop', 'joined_via', 'fandrop'),
      last_activity_at = timezone('utc', now()),
      completed_at = coalesce(public.mission_task_progress.completed_at, timezone('utc', now()));
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
    'joined', true,
    'alreadyJoined', false,
    'campaignSlug', normalized_slug,
    'joinedAt', joined_at_value,
    'notificationId', created_notification_id
  );
end;
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
  all_required_tasks_completed boolean := false;
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
  into all_required_tasks_completed
  from public.mission_tasks task
  left join public.mission_task_progress progress
    on progress.mission_task_id = task.id
   and progress.profile_id = input_profile_id
  where task.mission_id = input_mission_id
    and coalesce((task.config->>'optional')::boolean, false) = false;

  if coalesce(all_required_tasks_completed, false) = false then
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
  where task.mission_id = input_mission_id
    and coalesce((task.config->>'optional')::boolean, false) = false;

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
        and coalesce((task.config->>'optional')::boolean, false) = false
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
        and coalesce((task.config->>'optional')::boolean, false) = false
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

grant execute on function public.get_profile_fandrops(uuid, text) to anon, authenticated;
grant execute on function public.join_fandrop_campaign(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.claim_mission_reward(uuid, uuid) to anon, authenticated;
