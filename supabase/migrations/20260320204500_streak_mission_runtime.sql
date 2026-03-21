create or replace function public.ensure_default_streak_missions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  first_check_in_mission_id uuid;
  three_day_mission_id uuid;
  seven_day_mission_id uuid;
begin
  insert into public.missions (
    slug,
    title,
    description,
    status,
    reward_e1xp,
    is_repeatable,
    max_claims_per_profile,
    config
  )
  select
    'streak-first-check-in',
    'Launch your streak',
    'Complete your first daily login check-in and unlock a starter bonus.',
    'active',
    20,
    false,
    1,
    jsonb_build_object(
      'category',
      'streak',
      'surface',
      'streaks'
    )
  where not exists (
    select 1
    from public.missions mission
    where lower(mission.slug) = 'streak-first-check-in'
  );

  insert into public.missions (
    slug,
    title,
    description,
    status,
    reward_e1xp,
    is_repeatable,
    max_claims_per_profile,
    config
  )
  select
    'streak-three-day-run',
    '3-day run',
    'Keep your streak alive for three days in a row to unlock bonus E1XP.',
    'active',
    75,
    false,
    1,
    jsonb_build_object(
      'category',
      'streak',
      'surface',
      'streaks'
    )
  where not exists (
    select 1
    from public.missions mission
    where lower(mission.slug) = 'streak-three-day-run'
  );

  insert into public.missions (
    slug,
    title,
    description,
    status,
    reward_e1xp,
    is_repeatable,
    max_claims_per_profile,
    config
  )
  select
    'streak-seven-day-fire',
    '7-day fire',
    'Hit a full week streak and claim an extra E1XP mission payout.',
    'active',
    175,
    false,
    1,
    jsonb_build_object(
      'category',
      'streak',
      'surface',
      'streaks'
    )
  where not exists (
    select 1
    from public.missions mission
    where lower(mission.slug) = 'streak-seven-day-fire'
  );

  update public.missions
  set
    title = 'Launch your streak',
    description = 'Complete your first daily login check-in and unlock a starter bonus.',
    status = 'active',
    reward_e1xp = 20,
    is_repeatable = false,
    max_claims_per_profile = 1,
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
      'category',
      'streak',
      'surface',
      'streaks'
    )
  where lower(slug) = 'streak-first-check-in';

  update public.missions
  set
    title = '3-day run',
    description = 'Keep your streak alive for three days in a row to unlock bonus E1XP.',
    status = 'active',
    reward_e1xp = 75,
    is_repeatable = false,
    max_claims_per_profile = 1,
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
      'category',
      'streak',
      'surface',
      'streaks'
    )
  where lower(slug) = 'streak-three-day-run';

  update public.missions
  set
    title = '7-day fire',
    description = 'Hit a full week streak and claim an extra E1XP mission payout.',
    status = 'active',
    reward_e1xp = 175,
    is_repeatable = false,
    max_claims_per_profile = 1,
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
      'category',
      'streak',
      'surface',
      'streaks'
    )
  where lower(slug) = 'streak-seven-day-fire';

  select id
  into first_check_in_mission_id
  from public.missions mission
  where lower(mission.slug) = 'streak-first-check-in'
  limit 1;

  select id
  into three_day_mission_id
  from public.missions mission
  where lower(mission.slug) = 'streak-three-day-run'
  limit 1;

  select id
  into seven_day_mission_id
  from public.missions mission
  where lower(mission.slug) = 'streak-seven-day-fire'
  limit 1;

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
  select
    first_check_in_mission_id,
    'first-check-in',
    'Check in once',
    'Complete your first Every1 daily login check-in.',
    'streak_check_in',
    1,
    1,
    0,
    jsonb_build_object(
      'surface',
      'streaks'
    )
  where first_check_in_mission_id is not null
    and not exists (
      select 1
      from public.mission_tasks task
      where task.mission_id = first_check_in_mission_id
        and lower(task.task_key) = 'first-check-in'
    );

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
  select
    three_day_mission_id,
    'three-day-streak',
    'Reach a 3-day streak',
    'Keep logging in until you hit day 3.',
    'streak_check_in',
    1,
    3,
    0,
    jsonb_build_object(
      'surface',
      'streaks'
    )
  where three_day_mission_id is not null
    and not exists (
      select 1
      from public.mission_tasks task
      where task.mission_id = three_day_mission_id
        and lower(task.task_key) = 'three-day-streak'
    );

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
  select
    seven_day_mission_id,
    'seven-day-streak',
    'Reach a 7-day streak',
    'Log in for a full week in a row.',
    'streak_check_in',
    1,
    7,
    0,
    jsonb_build_object(
      'surface',
      'streaks'
    )
  where seven_day_mission_id is not null
    and not exists (
      select 1
      from public.mission_tasks task
      where task.mission_id = seven_day_mission_id
        and lower(task.task_key) = 'seven-day-streak'
    );

  update public.mission_tasks
  set
    title = 'Check in once',
    description = 'Complete your first Every1 daily login check-in.',
    task_type = 'streak_check_in',
    position = 1,
    target_count = 1,
    reward_e1xp = 0,
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
      'surface',
      'streaks'
    )
  where mission_id = first_check_in_mission_id
    and lower(task_key) = 'first-check-in';

  update public.mission_tasks
  set
    title = 'Reach a 3-day streak',
    description = 'Keep logging in until you hit day 3.',
    task_type = 'streak_check_in',
    position = 1,
    target_count = 3,
    reward_e1xp = 0,
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
      'surface',
      'streaks'
    )
  where mission_id = three_day_mission_id
    and lower(task_key) = 'three-day-streak';

  update public.mission_tasks
  set
    title = 'Reach a 7-day streak',
    description = 'Log in for a full week in a row.',
    task_type = 'streak_check_in',
    position = 1,
    target_count = 7,
    reward_e1xp = 0,
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
      'surface',
      'streaks'
    )
  where mission_id = seven_day_mission_id
    and lower(task_key) = 'seven-day-streak';
end;
$$;

create or replace function public.sync_streak_mission_progress(
  input_profile_id uuid,
  input_current_streak integer,
  input_activity_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mission_row record;
  progress_row public.mission_task_progress%rowtype;
  next_current_value integer;
  next_status public.mission_progress_status;
  just_completed boolean;
  completed_mission_ids jsonb := '[]'::jsonb;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  perform public.ensure_default_streak_missions();

  for mission_row in
    select
      mission.id as mission_id,
      mission.title as mission_title,
      mission.reward_e1xp as mission_reward_e1xp,
      task.id as mission_task_id,
      task.target_count,
      task.title as task_title
    from public.missions mission
    join public.mission_tasks task
      on task.mission_id = mission.id
    where mission.status = 'active'
      and task.task_type = 'streak_check_in'
    order by task.target_count asc, task.position asc, mission.created_at asc
  loop
    select *
    into progress_row
    from public.mission_task_progress progress
    where progress.mission_task_id = mission_row.mission_task_id
      and progress.profile_id = input_profile_id
    for update;

    if progress_row.mission_task_id is null then
      insert into public.mission_task_progress (
        mission_task_id,
        profile_id,
        status,
        current_value,
        target_value,
        metadata,
        last_activity_at
      )
      values (
        mission_row.mission_task_id,
        input_profile_id,
        'not_started',
        0,
        mission_row.target_count,
        '{}'::jsonb,
        timezone('utc', now())
      )
      returning *
      into progress_row;
    end if;

    next_current_value := least(
      greatest(coalesce(input_current_streak, 0), 0),
      mission_row.target_count
    );

    next_status := case
      when progress_row.status = 'claimed' then 'claimed'
      when progress_row.status = 'completed' then 'completed'
      when next_current_value >= mission_row.target_count then 'completed'
      when next_current_value > 0 then 'in_progress'
      else 'not_started'
    end;

    just_completed := progress_row.status not in ('completed', 'claimed')
      and next_status = 'completed';

    update public.mission_task_progress
    set
      status = next_status,
      current_value = case
        when progress_row.status in ('completed', 'claimed') then mission_row.target_count
        else next_current_value
      end,
      target_value = mission_row.target_count,
      metadata = jsonb_build_object(
        'surface',
        'streaks',
        'current_streak',
        greatest(coalesce(input_current_streak, 0), 0),
        'last_activity_date',
        coalesce(input_activity_date, timezone('utc', now())::date)
      ),
      last_activity_at = timezone('utc', now()),
      completed_at = case
        when next_status in ('completed', 'claimed') then coalesce(progress_row.completed_at, timezone('utc', now()))
        else null
      end
    where mission_task_id = mission_row.mission_task_id
      and profile_id = input_profile_id;

    if just_completed then
      completed_mission_ids := completed_mission_ids || to_jsonb(mission_row.mission_id);

      perform public.create_notification(
        input_profile_id,
        null,
        'mission',
        format('Mission complete: %s', mission_row.mission_title),
        format(
          'Claim +%s E1XP from your streak page.',
          coalesce(mission_row.mission_reward_e1xp, 0)
        ),
        null,
        format('mission:%s', mission_row.mission_id),
        jsonb_build_object(
          'mission_id',
          mission_row.mission_id,
          'mission_title',
          mission_row.mission_title,
          'reward_e1xp',
          coalesce(mission_row.mission_reward_e1xp, 0),
          'task_title',
          mission_row.task_title
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'completedMissionIds',
    completed_mission_ids
  );
end;
$$;

create or replace function public.get_profile_missions(
  input_profile_id uuid,
  input_task_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_streak_value integer := 0;
  normalized_task_type text := lower(nullif(trim(input_task_type), ''));
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  perform public.ensure_default_streak_missions();

  select coalesce(streak.current_streak, 0)
  into current_streak_value
  from public.daily_streaks streak
  where streak.profile_id = input_profile_id;

  if normalized_task_type is null or normalized_task_type = 'streak_check_in' then
    perform public.sync_streak_mission_progress(
      input_profile_id,
      coalesce(current_streak_value, 0),
      timezone('utc', now())::date
    );
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id',
          mission.id,
          'slug',
          mission.slug,
          'title',
          mission.title,
          'description',
          mission.description,
          'status',
          mission.status,
          'rewardE1xp',
          mission.reward_e1xp,
          'isRepeatable',
          mission.is_repeatable,
          'taskType',
          task.task_type,
          'taskTitle',
          task.title,
          'currentValue',
          case
            when coalesce(progress.status, 'not_started'::public.mission_progress_status) in ('completed', 'claimed')
              then task.target_count
            else least(task.target_count, greatest(coalesce(current_streak_value, 0), coalesce(progress.current_value, 0)))
          end,
          'targetValue',
          task.target_count,
          'progressStatus',
          coalesce(progress.status, 'not_started'::public.mission_progress_status),
          'completedAt',
          progress.completed_at,
          'claimedAt',
          progress.claimed_at,
          'availableToClaim',
          coalesce(progress.status, 'not_started'::public.mission_progress_status) = 'completed',
          'percentComplete',
          least(
            100,
            round(
              (
                case
                  when coalesce(progress.status, 'not_started'::public.mission_progress_status) in ('completed', 'claimed')
                    then task.target_count
                  else least(task.target_count, greatest(coalesce(current_streak_value, 0), coalesce(progress.current_value, 0)))
                end
              )::numeric * 100 / greatest(task.target_count, 1)
            )::integer
          )
        )
        order by task.target_count asc, mission.created_at asc
      )
      from public.missions mission
      join public.mission_tasks task
        on task.mission_id = mission.id
      left join public.mission_task_progress progress
        on progress.mission_task_id = task.id
       and progress.profile_id = input_profile_id
      where mission.status = 'active'
        and (
          normalized_task_type is null
          or lower(task.task_type::text) = normalized_task_type
        )
    ),
    '[]'::jsonb
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
  all_tasks_completed boolean := false;
  already_claimed boolean := false;
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
    'rewardE1xp',
    reward_e1xp
  );
end;
$$;

create or replace function public.record_daily_login_streak(
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_summary public.daily_streaks%rowtype;
  current_utc_date date := timezone('utc', now())::date;
  previous_activity_date date;
  next_streak integer;
  next_longest_streak integer;
  reward_e1xp integer;
  reset_occurred boolean := false;
  already_claimed boolean := false;
  milestone_reached boolean := false;
  notification_id uuid;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = input_profile_id
  ) then
    raise exception 'profile not found';
  end if;

  perform public.ensure_default_streak_missions();

  insert into public.daily_streaks (profile_id)
  values (input_profile_id)
  on conflict (profile_id) do nothing;

  select *
  into current_summary
  from public.daily_streaks streak
  where streak.profile_id = input_profile_id
  for update;

  already_claimed := exists (
    select 1
    from public.daily_streak_events event
    where event.profile_id = input_profile_id
      and event.activity_date = current_utc_date
      and event.event_type = 'check_in'
      and coalesce(event.source_key, '') = 'daily-login'
  );

  if already_claimed then
    return jsonb_build_object(
      'claimed',
      false,
      'alreadyClaimed',
      true,
      'activityDate',
      current_utc_date,
      'currentStreak',
      coalesce(current_summary.current_streak, 0),
      'longestStreak',
      coalesce(current_summary.longest_streak, 0),
      'rewardE1xp',
      0,
      'resetOccurred',
      false,
      'milestoneReached',
      false,
      'notificationId',
      null,
      'dashboard',
      public.get_daily_streak_dashboard(input_profile_id)
    );
  end if;

  previous_activity_date := current_summary.last_activity_date;

  if previous_activity_date = current_utc_date - 1 then
    next_streak := coalesce(current_summary.current_streak, 0) + 1;
  elsif previous_activity_date = current_utc_date then
    next_streak := greatest(coalesce(current_summary.current_streak, 0), 1);
  elsif previous_activity_date is null then
    next_streak := 1;
  else
    reset_occurred := coalesce(current_summary.current_streak, 0) > 0;
    next_streak := 1;
  end if;

  next_longest_streak := greatest(
    coalesce(current_summary.longest_streak, 0),
    next_streak
  );
  reward_e1xp := public.get_daily_streak_reward_e1xp(next_streak);
  milestone_reached := reward_e1xp > 25;

  update public.daily_streaks
  set
    current_streak = next_streak,
    longest_streak = next_longest_streak,
    last_activity_date = current_utc_date
  where profile_id = input_profile_id;

  insert into public.daily_streak_events (
    profile_id,
    activity_date,
    event_type,
    source_key,
    metadata
  )
  values (
    input_profile_id,
    current_utc_date,
    'check_in',
    'daily-login',
    jsonb_build_object(
      'current_streak',
      next_streak,
      'reward_e1xp',
      reward_e1xp,
      'reset_occurred',
      reset_occurred,
      'milestone_reached',
      milestone_reached
    )
  );

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
    'streak',
    format('daily-login:%s', current_utc_date),
    reward_e1xp,
    case
      when milestone_reached then format(
        'Daily streak milestone reward for day %s',
        next_streak
      )
      else format(
        'Daily login streak reward for day %s',
        next_streak
      )
    end,
    jsonb_build_object(
      'activity_date',
      current_utc_date,
      'current_streak',
      next_streak,
      'reset_occurred',
      reset_occurred,
      'milestone_reached',
      milestone_reached
    )
  );

  perform public.sync_streak_mission_progress(
    input_profile_id,
    next_streak,
    current_utc_date
  );

  notification_id := public.create_notification(
    input_profile_id,
    null,
    'streak',
    case
      when milestone_reached then format(
        'Day %s streak milestone unlocked',
        next_streak
      )
      else format(
        'Daily streak claimed for day %s',
        next_streak
      )
    end,
    case
      when milestone_reached then format(
        'You earned %s E1XP for keeping your Every1 streak alive.',
        reward_e1xp
      )
      else format(
        'You earned %s E1XP for logging in today.',
        reward_e1xp
      )
    end,
    null,
    format('daily-login:%s', current_utc_date),
    jsonb_build_object(
      'reward_e1xp',
      reward_e1xp,
      'current_streak',
      next_streak,
      'milestone_reached',
      milestone_reached,
      'activity_date',
      current_utc_date
    )
  );

  return jsonb_build_object(
    'claimed',
    true,
    'alreadyClaimed',
    false,
    'activityDate',
    current_utc_date,
    'currentStreak',
    next_streak,
    'longestStreak',
    next_longest_streak,
    'rewardE1xp',
    reward_e1xp,
    'resetOccurred',
    reset_occurred,
    'milestoneReached',
    milestone_reached,
    'notificationId',
    notification_id,
    'dashboard',
    public.get_daily_streak_dashboard(input_profile_id)
  );
end;
$$;

grant execute on function public.ensure_default_streak_missions() to anon, authenticated;
grant execute on function public.sync_streak_mission_progress(uuid, integer, date) to anon, authenticated;
grant execute on function public.get_profile_missions(uuid, text) to anon, authenticated;
grant execute on function public.claim_mission_reward(uuid, uuid) to anon, authenticated;

select public.ensure_default_streak_missions();
