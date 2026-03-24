create or replace function public.cancel_collaboration_coin_invite(
  input_profile_id uuid,
  input_collaboration_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  collaboration_record public.creator_collaborations%rowtype;
  collaborator_member public.creator_collaboration_members%rowtype;
  collaborator_profile public.profiles%rowtype;
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

  select *
  into collaboration_record
  from public.creator_collaborations
  where id = input_collaboration_id;

  if not found then
    raise exception 'Collaboration was not found.'
      using errcode = 'P0002';
  end if;

  if collaboration_record.owner_id <> input_profile_id then
    raise exception 'Only the collaboration creator can cancel this invite.'
      using errcode = '22023';
  end if;

  if collaboration_record.split_locked_at is not null
    or collaboration_record.accepted_at is not null then
    raise exception 'Accepted collaborations cannot be cancelled here.'
      using errcode = '22023';
  end if;

  if collaboration_record.status not in ('draft', 'open') then
    raise exception 'This collaboration invite is no longer pending.'
      using errcode = '22023';
  end if;

  select *
  into collaborator_member
  from public.creator_collaboration_members
  where collaboration_id = input_collaboration_id
    and role <> 'owner'
  order by created_at asc
  limit 1;

  select *
  into owner_profile
  from public.profiles
  where id = collaboration_record.owner_id;

  if collaborator_member.profile_id is not null then
    select *
    into collaborator_profile
    from public.profiles
    where id = collaborator_member.profile_id;
  end if;

  update public.creator_collaborations
  set status = 'closed'
  where id = input_collaboration_id;

  update public.creator_launches
  set status = 'archived'
  where id = collaboration_record.launch_id
    and status in ('draft', 'ready');

  update public.creator_collaboration_members
  set status = case
      when role = 'owner' then status
      when status = 'invited' then 'removed'::public.collaboration_member_status
      else status
    end,
      invite_expires_at = null
  where collaboration_id = input_collaboration_id;

  if collaborator_member.profile_id is not null then
    created_notification_id := public.create_notification(
      collaborator_member.profile_id,
      collaboration_record.owner_id,
      'system',
      'Collaboration cancelled',
      format(
        '%s cancelled the collaboration invite for "%s".',
        coalesce(
          nullif(trim(owner_profile.display_name), ''),
          nullif(trim(owner_profile.username), ''),
          'The creator'
        ),
        collaboration_record.title
      ),
      null,
      input_collaboration_id::text,
      jsonb_build_object(
        'collaborationId', input_collaboration_id,
        'decision', 'cancel'
      )
    );
  end if;

  return jsonb_build_object(
    'collaborationId', input_collaboration_id,
    'notificationId', created_notification_id,
    'status', 'closed'
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
  cover_image_url text,
  created_at timestamptz,
  description text,
  invite_expires_at timestamptz,
  is_expired boolean,
  launch_id uuid,
  launch_status public.creator_launch_status,
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
      launch.cover_image_url,
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
    collaboration.cover_image_url,
    collaboration.created_at,
    collaboration.description,
    collaboration.invite_expires_at,
    collaboration.is_expired,
    collaboration.launch_id,
    collaboration.launch_status,
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

grant execute on function public.cancel_collaboration_coin_invite(
  uuid,
  uuid
) to anon, authenticated;

grant execute on function public.list_profile_collaborations(
  uuid,
  boolean
) to anon, authenticated;
