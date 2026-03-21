create or replace function public.get_daily_streak_reward_e1xp(
  input_streak integer
)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(input_streak, 0) >= 30 and mod(input_streak, 30) = 0 then 300
    when coalesce(input_streak, 0) >= 7 and mod(input_streak, 7) = 0 then 100
    else 25
  end;
$$;

create or replace function public.get_next_daily_streak_milestone(
  input_streak integer
)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(input_streak, 0) < 7 then 7
    when coalesce(input_streak, 0) < 30 then 30
    else (floor(coalesce(input_streak, 0) / 30.0)::integer + 1) * 30
  end;
$$;

create or replace function public.get_daily_streak_dashboard(
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
  projected_streak integer;
  next_milestone integer;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  insert into public.daily_streaks (profile_id)
  values (input_profile_id)
  on conflict (profile_id) do nothing;

  select *
  into current_summary
  from public.daily_streaks streak
  where streak.profile_id = input_profile_id;

  projected_streak := case
    when current_summary.last_activity_date = current_utc_date then greatest(current_summary.current_streak, 1)
    when current_summary.last_activity_date = current_utc_date - 1 then coalesce(current_summary.current_streak, 0) + 1
    else 1
  end;

  next_milestone := public.get_next_daily_streak_milestone(
    coalesce(current_summary.current_streak, 0)
  );

  return jsonb_build_object(
    'profileId',
    input_profile_id,
    'currentStreak',
    coalesce(current_summary.current_streak, 0),
    'longestStreak',
    coalesce(current_summary.longest_streak, 0),
    'streakFreezes',
    coalesce(current_summary.streak_freezes, 0),
    'lastActivityDate',
    current_summary.last_activity_date,
    'claimedToday',
    exists (
      select 1
      from public.daily_streak_events event
      where event.profile_id = input_profile_id
        and event.activity_date = current_utc_date
        and event.event_type = 'check_in'
        and coalesce(event.source_key, '') = 'daily-login'
    ),
    'todayRewardE1xp',
    public.get_daily_streak_reward_e1xp(projected_streak),
    'totalStreakE1xp',
    coalesce(
      (
        select sum(entry.amount)::integer
        from public.e1xp_ledger entry
        where entry.profile_id = input_profile_id
          and entry.source = 'streak'
      ),
      0
    ),
    'nextMilestone',
    next_milestone,
    'nextMilestoneRewardE1xp',
    public.get_daily_streak_reward_e1xp(next_milestone),
    'last7Days',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'date',
            day_item.day_value,
            'label',
            lower(trim(to_char(day_item.day_value, 'Dy'))),
            'dayOfMonth',
            extract(day from day_item.day_value)::integer,
            'completed',
            exists (
              select 1
              from public.daily_streak_events event
              where event.profile_id = input_profile_id
                and event.activity_date = day_item.day_value
            ),
            'isToday',
            day_item.day_value = current_utc_date
          )
          order by day_item.day_value
        )
        from (
          select generated_day::date as day_value
          from generate_series(
            current_utc_date - 6,
            current_utc_date,
            interval '1 day'
          ) generated_day
        ) as day_item
      ),
      '[]'::jsonb
    ),
    'recentRewards',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            entry.id,
            'amount',
            entry.amount,
            'description',
            entry.description,
            'createdAt',
            entry.created_at,
            'metadata',
            entry.metadata
          )
          order by entry.created_at desc
        )
        from (
          select *
          from public.e1xp_ledger entry
          where entry.profile_id = input_profile_id
            and entry.source = 'streak'
          order by entry.created_at desc
          limit 8
        ) as entry
      ),
      '[]'::jsonb
    )
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

grant execute on function public.get_daily_streak_reward_e1xp(integer) to anon, authenticated;
grant execute on function public.get_next_daily_streak_milestone(integer) to anon, authenticated;
grant execute on function public.get_daily_streak_dashboard(uuid) to anon, authenticated;
grant execute on function public.record_daily_login_streak(uuid) to anon, authenticated;
