do $$
begin
  begin
    alter type public.mobile_nav_badge_key add value if not exists 'creators_new_profiles';
  exception
    when duplicate_object then
      null;
  end;
end
$$;

create or replace function public.get_mobile_nav_badge_counts(
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  creators_last_seen timestamptz;
  explore_last_seen timestamptz;
  leaderboard_last_seen timestamptz;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  select badge_state.last_seen_at
  into creators_last_seen
  from public.mobile_nav_badge_states badge_state
  where badge_state.profile_id = input_profile_id
    and badge_state.badge_key = 'creators_new_profiles';

  select badge_state.last_seen_at
  into explore_last_seen
  from public.mobile_nav_badge_states badge_state
  where badge_state.profile_id = input_profile_id
    and badge_state.badge_key = 'explore_new_coins';

  select badge_state.last_seen_at
  into leaderboard_last_seen
  from public.mobile_nav_badge_states badge_state
  where badge_state.profile_id = input_profile_id
    and badge_state.badge_key = 'leaderboard_updates';

  return jsonb_build_object(
    'creatorsCount',
    coalesce(
      (
        select count(*)::integer
        from public.profiles profile
        where nullif(trim(coalesce(profile.display_name, profile.username, profile.zora_handle, '')), '') is not null
          and profile.created_at >
            coalesce(creators_last_seen, '-infinity'::timestamptz)
          and profile.id <> input_profile_id
      ),
      0
    ),
    'exploreCount',
    coalesce(
      (
        select count(*)::integer
        from public.creator_launches launch
        where launch.status = 'launched'
          and coalesce(launch.launched_at, launch.created_at) >
            coalesce(explore_last_seen, '-infinity'::timestamptz)
      ),
      0
    ),
    'leaderboardCount',
    coalesce(
      (
        select count(*)::integer
        from public.leaderboard_updates update_item
        where update_item.created_at >
          coalesce(leaderboard_last_seen, '-infinity'::timestamptz)
      ),
      0
    )
  );
end;
$$;

comment on function public.get_mobile_nav_badge_counts(uuid) is
  'Returns live Explore, Creators, and Leaderboard badge counts based on launched coins, new public creator profiles, and leaderboard updates since the profile last viewed each section.';
