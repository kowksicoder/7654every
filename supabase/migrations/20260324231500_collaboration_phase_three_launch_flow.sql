create or replace function public.complete_collaboration_coin_launch(
  input_profile_id uuid,
  input_collaboration_id uuid,
  input_coin_address text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_coin_address text := lower(nullif(trim(input_coin_address), ''));
  collaboration_record public.creator_collaborations%rowtype;
  launch_record public.creator_launches%rowtype;
  collaborator_member public.creator_collaboration_members%rowtype;
  owner_profile public.profiles%rowtype;
  created_notification_id uuid;
begin
  if input_profile_id is null then
    raise exception 'Profile is required.'
      using errcode = '23502';
  end if;

  if input_collaboration_id is null then
    raise exception 'Collaboration is required.'
      using errcode = '23502';
  end if;

  if normalized_coin_address is null then
    raise exception 'Coin address is required.'
      using errcode = '23502';
  end if;

  if normalized_coin_address !~ '^0x[a-f0-9]{40}$' then
    raise exception 'Coin address must be a valid Base address.'
      using errcode = '22P02';
  end if;

  select *
  into collaboration_record
  from public.creator_collaborations
  where id = input_collaboration_id;

  if not found then
    raise exception 'Collaboration was not found.'
      using errcode = 'P0002';
  end if;

  if collaboration_record.owner_id <> input_profile_id then
    raise exception 'Only the collaboration creator can launch this coin.'
      using errcode = '22023';
  end if;

  if collaboration_record.status not in ('open', 'active') then
    raise exception 'This collaboration is not ready to launch.'
      using errcode = '22023';
  end if;

  select *
  into launch_record
  from public.creator_launches
  where id = collaboration_record.launch_id;

  if not found then
    raise exception 'Launch draft was not found for this collaboration.'
      using errcode = 'P0002';
  end if;

  if nullif(trim(coalesce(launch_record.coin_address, '')), '') is not null then
    raise exception 'This collaboration coin has already been launched.'
      using errcode = '22023';
  end if;

  if launch_record.status not in ('ready', 'launching', 'draft') then
    raise exception 'This launch is not in a launchable state.'
      using errcode = '22023';
  end if;

  update public.creator_launches
  set coin_address = normalized_coin_address,
      status = 'launched',
      launch_error = null,
      launched_at = timezone('utc', now())
  where id = launch_record.id;

  update public.creator_collaborations
  set status = 'active'
  where id = collaboration_record.id;

  select *
  into owner_profile
  from public.profiles
  where id = collaboration_record.owner_id;

  for collaborator_member in
    select *
    from public.creator_collaboration_members member
    where member.collaboration_id = collaboration_record.id
      and member.role <> 'owner'
      and member.status = 'active'
  loop
    created_notification_id := public.create_notification(
      collaborator_member.profile_id,
      collaboration_record.owner_id,
      'system',
      'Collaboration coin launched',
      format(
        '%s launched "%s" and the shared coin is now live.',
        coalesce(
          nullif(trim(owner_profile.display_name), ''),
          nullif(trim(owner_profile.username), ''),
          'The creator'
        ),
        collaboration_record.title
      ),
      null,
      collaboration_record.id::text,
      jsonb_build_object(
        'coinAddress', normalized_coin_address,
        'collaborationId', collaboration_record.id,
        'launchId', launch_record.id
      )
    );
  end loop;

  return jsonb_build_object(
    'coinAddress', normalized_coin_address,
    'collaborationId', collaboration_record.id,
    'launchId', launch_record.id,
    'notificationId', created_notification_id,
    'status', 'active'
  );
end;
$$;

drop function if exists public.list_profile_collaborations(uuid, boolean);

create function public.list_profile_collaborations(
  input_profile_id uuid,
  input_include_private boolean default false
)
returns table (
  accepted_at timestamptz,
  active_member_count integer,
  collaboration_id uuid,
  coin_address text,
  cover_image_url text,
  created_at timestamptz,
  description text,
  invite_expires_at timestamptz,
  is_expired boolean,
  launch_id uuid,
  launch_status public.creator_launch_status,
  metadata_uri text,
  members jsonb,
  owner_avatar_url text,
  owner_display_name text,
  owner_id uuid,
  owner_username text,
  pending_member_count integer,
  split_locked_at timestamptz,
  status public.collaboration_status,
  ticker text,
  title text,
  viewer_can_cancel boolean,
  viewer_can_launch boolean,
  viewer_can_respond boolean,
  viewer_role public.collaboration_role,
  viewer_status public.collaboration_member_status
)
language sql
stable
security definer
set search_path = public
as $$
  with relevant_collaborations as (
    select
      collaboration.id,
      collaboration.accepted_at,
      collaboration.created_at,
      collaboration.description,
      collaboration.launch_id,
      collaboration.owner_id,
      collaboration.split_locked_at,
      collaboration.status,
      collaboration.title,
      launch.coin_address,
      launch.cover_image_url,
      launch.metadata_uri,
      launch.status as launch_status,
      launch.ticker,
      owner.avatar_url as owner_avatar_url,
      owner.display_name as owner_display_name,
      owner.username as owner_username,
      viewer_member.role as viewer_role,
      viewer_member.status as viewer_status,
      (
        select min(member.invite_expires_at)
        from public.creator_collaboration_members member
        where member.collaboration_id = collaboration.id
          and member.role <> 'owner'
          and member.status = 'invited'
      ) as invite_expires_at,
      (
        select count(*)
        from public.creator_collaboration_members member
        where member.collaboration_id = collaboration.id
          and member.status = 'active'
      )::integer as active_member_count,
      (
        select count(*)
        from public.creator_collaboration_members member
        where member.collaboration_id = collaboration.id
          and member.role <> 'owner'
          and member.status = 'invited'
      )::integer as pending_member_count,
      exists (
        select 1
        from public.creator_collaboration_members member
        where member.collaboration_id = collaboration.id
          and member.role <> 'owner'
          and member.status = 'invited'
          and member.invite_expires_at is not null
          and member.invite_expires_at < timezone('utc', now())
      ) as is_expired
    from public.creator_collaborations collaboration
    inner join public.creator_launches launch
      on launch.id = collaboration.launch_id
    inner join public.profiles owner
      on owner.id = collaboration.owner_id
    left join public.creator_collaboration_members viewer_member
      on viewer_member.collaboration_id = collaboration.id
      and viewer_member.profile_id = input_profile_id
    where (
      input_include_private
      and (
        collaboration.owner_id = input_profile_id
        or viewer_member.profile_id = input_profile_id
      )
    ) or (
      not input_include_private
      and collaboration.status in ('open', 'active')
      and (
        collaboration.owner_id = input_profile_id
        or exists (
          select 1
          from public.creator_collaboration_members active_member
          where active_member.collaboration_id = collaboration.id
            and active_member.profile_id = input_profile_id
            and active_member.status = 'active'
        )
      )
    )
  )
  select
    collaboration.accepted_at,
    collaboration.active_member_count,
    collaboration.id as collaboration_id,
    collaboration.coin_address,
    collaboration.cover_image_url,
    collaboration.created_at,
    collaboration.description,
    collaboration.invite_expires_at,
    collaboration.is_expired,
    collaboration.launch_id,
    collaboration.launch_status,
    collaboration.metadata_uri,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'acceptedAt', member.accepted_terms_at,
            'avatarUrl', profile.avatar_url,
            'displayName', profile.display_name,
            'inviteExpiresAt', member.invite_expires_at,
            'joinedAt', member.joined_at,
            'note', member.note,
            'profileId', member.profile_id,
            'role', member.role,
            'splitPercent', member.split_percent,
            'status', member.status,
            'username', profile.username
          )
          order by case when member.role = 'owner' then 0 else 1 end, member.created_at
        )
        from public.creator_collaboration_members member
        inner join public.profiles profile
          on profile.id = member.profile_id
        where member.collaboration_id = collaboration.id
      ),
      '[]'::jsonb
    ) as members,
    collaboration.owner_avatar_url,
    collaboration.owner_display_name,
    collaboration.owner_id,
    collaboration.owner_username,
    collaboration.pending_member_count,
    collaboration.split_locked_at,
    collaboration.status,
    collaboration.ticker,
    collaboration.title,
    (
      collaboration.owner_id = input_profile_id
      and collaboration.status = 'draft'
      and collaboration.split_locked_at is null
      and collaboration.pending_member_count > 0
    ) as viewer_can_cancel,
    (
      collaboration.owner_id = input_profile_id
      and collaboration.status = 'open'
      and collaboration.launch_status in ('ready', 'draft')
      and nullif(trim(coalesce(collaboration.coin_address, '')), '') is null
      and not collaboration.is_expired
    ) as viewer_can_launch,
    (
      collaboration.viewer_status = 'invited'
      and collaboration.owner_id <> input_profile_id
      and not collaboration.is_expired
      and (
        collaboration.invite_expires_at is null
        or collaboration.invite_expires_at >= timezone('utc', now())
      )
    ) as viewer_can_respond,
    collaboration.viewer_role,
    collaboration.viewer_status
  from relevant_collaborations collaboration
  order by collaboration.created_at desc;
$$;

grant execute on function public.complete_collaboration_coin_launch(
  uuid,
  uuid,
  text
) to anon, authenticated;

grant execute on function public.list_profile_collaborations(
  uuid,
  boolean
) to anon, authenticated;
