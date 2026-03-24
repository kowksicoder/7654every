alter table public.creator_collaborations
  add column if not exists accepted_at timestamptz,
  add column if not exists split_locked_at timestamptz;

alter table public.creator_collaboration_members
  add column if not exists split_percent numeric(5, 2) not null default 0,
  add column if not exists accepted_terms_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists invite_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'creator_collaboration_members_split_percent_range'
  ) then
    alter table public.creator_collaboration_members
      add constraint creator_collaboration_members_split_percent_range check (
        split_percent >= 0
        and split_percent <= 100
      );
  end if;
end
$$;

create index if not exists creator_collaboration_members_invite_expiry_idx
  on public.creator_collaboration_members (invite_expires_at)
  where invite_expires_at is not null;

create or replace function public.create_collaboration_coin_invite(
  input_owner_profile_id uuid,
  input_collaborator_profile_id uuid,
  input_ticker text,
  input_name text,
  input_description text default null,
  input_cover_image_url text default null,
  input_metadata_uri text default null,
  input_creator_split numeric default 60,
  input_collaborator_split numeric default 40,
  input_invite_note text default null,
  input_chain_id integer default 8453,
  input_supply bigint default 10000000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_ticker text := lower(nullif(trim(input_ticker), ''));
  normalized_name text := nullif(trim(input_name), '');
  normalized_description text := nullif(trim(input_description), '');
  normalized_cover_image_url text := nullif(trim(input_cover_image_url), '');
  normalized_metadata_uri text := nullif(trim(input_metadata_uri), '');
  normalized_invite_note text := nullif(trim(input_invite_note), '');
  owner_profile public.profiles%rowtype;
  collaborator_profile public.profiles%rowtype;
  created_launch public.creator_launches%rowtype;
  created_collaboration public.creator_collaborations%rowtype;
  owner_display_label text;
  collaborator_display_label text;
  created_notification_id uuid;
begin
  if input_owner_profile_id is null then
    raise exception 'Creator profile is required.'
      using errcode = '23502';
  end if;

  if input_collaborator_profile_id is null then
    raise exception 'Collaborator profile is required.'
      using errcode = '23502';
  end if;

  if input_owner_profile_id = input_collaborator_profile_id then
    raise exception 'You cannot collaborate with yourself.'
      using errcode = '22023';
  end if;

  if normalized_ticker is null then
    raise exception 'Ticker is required.'
      using errcode = '23502';
  end if;

  if normalized_name is null then
    raise exception 'Coin name is required.'
      using errcode = '23502';
  end if;

  if normalized_ticker !~ '^[a-z0-9]{1,8}$' then
    raise exception 'Ticker must be 1 to 8 lowercase letters or numbers.'
      using errcode = '22P02';
  end if;

  if coalesce(input_creator_split, 0) <= 0
    or coalesce(input_collaborator_split, 0) <= 0 then
    raise exception 'Both collaboration splits must be greater than zero.'
      using errcode = '22023';
  end if;

  if round(coalesce(input_creator_split, 0) + coalesce(input_collaborator_split, 0), 2) <> 100 then
    raise exception 'Collaboration splits must add up to 100%%.'
      using errcode = '22023';
  end if;

  select *
  into owner_profile
  from public.profiles
  where id = input_owner_profile_id;

  if not found then
    raise exception 'Creator profile was not found.'
      using errcode = 'P0002';
  end if;

  select *
  into collaborator_profile
  from public.profiles
  where id = input_collaborator_profile_id;

  if not found then
    raise exception 'Collaborator profile was not found.'
      using errcode = 'P0002';
  end if;

  insert into public.creator_launches (
    created_by,
    ticker,
    name,
    description,
    cover_image_url,
    metadata_uri,
    chain_id,
    supply,
    post_destination,
    status
  )
  values (
    input_owner_profile_id,
    normalized_ticker,
    normalized_name,
    normalized_description,
    normalized_cover_image_url,
    normalized_metadata_uri,
    coalesce(input_chain_id, 8453),
    greatest(coalesce(input_supply, 10000000), 1),
    'collaboration',
    'draft'
  )
  returning * into created_launch;

  insert into public.creator_collaborations (
    owner_id,
    launch_id,
    title,
    description,
    status,
    max_members
  )
  values (
    input_owner_profile_id,
    created_launch.id,
    normalized_name,
    normalized_description,
    'draft',
    2
  )
  returning * into created_collaboration;

  update public.creator_collaboration_members
  set role = 'owner',
      status = 'active',
      split_percent = round(coalesce(input_creator_split, 0), 2),
      joined_at = coalesce(joined_at, timezone('utc', now())),
      accepted_terms_at = coalesce(accepted_terms_at, timezone('utc', now())),
      declined_at = null,
      invite_expires_at = null
  where collaboration_id = created_collaboration.id
    and profile_id = input_owner_profile_id;

  insert into public.creator_collaboration_members (
    collaboration_id,
    profile_id,
    role,
    status,
    note,
    split_percent,
    invite_expires_at
  )
  values (
    created_collaboration.id,
    input_collaborator_profile_id,
    'contributor',
    'invited',
    normalized_invite_note,
    round(coalesce(input_collaborator_split, 0), 2),
    timezone('utc', now()) + interval '24 hours'
  )
  on conflict (collaboration_id, profile_id) do update
    set role = excluded.role,
        status = 'invited',
        note = excluded.note,
        split_percent = excluded.split_percent,
        invite_expires_at = excluded.invite_expires_at,
        joined_at = null,
        accepted_terms_at = null,
        declined_at = null;

  owner_display_label := coalesce(
    nullif(trim(owner_profile.display_name), ''),
    nullif(trim(owner_profile.username), ''),
    'A creator'
  );
  collaborator_display_label := coalesce(
    nullif(trim(collaborator_profile.display_name), ''),
    nullif(trim(collaborator_profile.username), ''),
    'Collaborator'
  );

  created_notification_id := public.create_notification(
    input_collaborator_profile_id,
    input_owner_profile_id,
    'system',
    'New collaboration invite',
    format(
      '%s invited you to collaborate on "%s". Your share is %s%%.',
      owner_display_label,
      normalized_name,
      trim(to_char(round(coalesce(input_collaborator_split, 0), 2), 'FM999990.##'))
    ),
    null,
    created_collaboration.id::text,
    jsonb_build_object(
      'collaborationId', created_collaboration.id,
      'collaboratorProfileId', input_collaborator_profile_id,
      'collaboratorShare', round(coalesce(input_collaborator_split, 0), 2),
      'creatorShare', round(coalesce(input_creator_split, 0), 2),
      'launchId', created_launch.id,
      'name', normalized_name,
      'ticker', normalized_ticker
    )
  );

  return jsonb_build_object(
    'collaborationId', created_collaboration.id,
    'collaboratorDisplayName', collaborator_display_label,
    'launchId', created_launch.id,
    'notificationId', created_notification_id,
    'status', created_collaboration.status,
    'ticker', created_launch.ticker,
    'title', created_collaboration.title
  );
end;
$$;

create or replace function public.respond_to_collaboration_coin_invite(
  input_profile_id uuid,
  input_collaboration_id uuid,
  input_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_decision text := lower(nullif(trim(input_decision), ''));
  collaboration_record public.creator_collaborations%rowtype;
  member_record public.creator_collaboration_members%rowtype;
  owner_profile public.profiles%rowtype;
  responder_profile public.profiles%rowtype;
  all_members_accepted boolean := false;
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

  if normalized_decision not in ('accept', 'decline') then
    raise exception 'Decision must be accept or decline.'
      using errcode = '22023';
  end if;

  select *
  into collaboration_record
  from public.creator_collaborations
  where id = input_collaboration_id;

  if not found then
    raise exception 'Collaboration was not found.'
      using errcode = 'P0002';
  end if;

  select *
  into member_record
  from public.creator_collaboration_members
  where collaboration_id = input_collaboration_id
    and profile_id = input_profile_id;

  if not found then
    raise exception 'You do not have an invite for this collaboration.'
      using errcode = 'P0002';
  end if;

  if member_record.role = 'owner' then
    raise exception 'Owners cannot respond to their own collaboration invite.'
      using errcode = '22023';
  end if;

  if member_record.status <> 'invited' then
    raise exception 'This collaboration invite has already been handled.'
      using errcode = '22023';
  end if;

  if member_record.invite_expires_at is not null
    and member_record.invite_expires_at < timezone('utc', now()) then
    raise exception 'This collaboration invite has expired.'
      using errcode = '22023';
  end if;

  select *
  into owner_profile
  from public.profiles
  where id = collaboration_record.owner_id;

  select *
  into responder_profile
  from public.profiles
  where id = input_profile_id;

  if normalized_decision = 'accept' then
    update public.creator_collaboration_members
    set status = 'active',
        joined_at = timezone('utc', now()),
        accepted_terms_at = timezone('utc', now()),
        declined_at = null
    where collaboration_id = input_collaboration_id
      and profile_id = input_profile_id;

    select not exists (
      select 1
      from public.creator_collaboration_members pending_member
      where pending_member.collaboration_id = input_collaboration_id
        and pending_member.role <> 'owner'
        and pending_member.status <> 'active'
    )
    into all_members_accepted;

    if all_members_accepted then
      update public.creator_collaborations
      set status = 'open',
          accepted_at = timezone('utc', now()),
          split_locked_at = timezone('utc', now())
      where id = input_collaboration_id;

      update public.creator_launches
      set status = 'ready'
      where id = collaboration_record.launch_id
        and status = 'draft';
    end if;

    created_notification_id := public.create_notification(
      collaboration_record.owner_id,
      input_profile_id,
      'system',
      'Collaboration accepted',
      format(
        '%s accepted the revenue split for "%s".',
        coalesce(
          nullif(trim(responder_profile.display_name), ''),
          nullif(trim(responder_profile.username), ''),
          'Your collaborator'
        ),
        collaboration_record.title
      ),
      null,
      input_collaboration_id::text,
      jsonb_build_object(
        'collaborationId', input_collaboration_id,
        'decision', 'accept'
      )
    );
  else
    update public.creator_collaboration_members
    set status = 'declined',
        declined_at = timezone('utc', now())
    where collaboration_id = input_collaboration_id
      and profile_id = input_profile_id;

    update public.creator_collaborations
    set status = 'closed'
    where id = input_collaboration_id;

    update public.creator_launches
    set status = 'archived'
    where id = collaboration_record.launch_id
      and status in ('draft', 'ready');

    created_notification_id := public.create_notification(
      collaboration_record.owner_id,
      input_profile_id,
      'system',
      'Collaboration declined',
      format(
        '%s declined the invite for "%s".',
        coalesce(
          nullif(trim(responder_profile.display_name), ''),
          nullif(trim(responder_profile.username), ''),
          'Your collaborator'
        ),
        collaboration_record.title
      ),
      null,
      input_collaboration_id::text,
      jsonb_build_object(
        'collaborationId', input_collaboration_id,
        'decision', 'decline'
      )
    );
  end if;

  return jsonb_build_object(
    'collaborationId', input_collaboration_id,
    'decision', normalized_decision,
    'notificationId', created_notification_id,
    'status', (
      select status
      from public.creator_collaborations
      where id = input_collaboration_id
    )
  );
end;
$$;

create or replace function public.list_profile_collaborations(
  input_profile_id uuid,
  input_include_private boolean default false
)
returns table (
  accepted_at timestamptz,
  collaboration_id uuid,
  cover_image_url text,
  created_at timestamptz,
  description text,
  invite_expires_at timestamptz,
  launch_id uuid,
  launch_status public.creator_launch_status,
  members jsonb,
  owner_avatar_url text,
  owner_display_name text,
  owner_id uuid,
  owner_username text,
  split_locked_at timestamptz,
  status public.collaboration_status,
  ticker text,
  title text,
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
      viewer_member.invite_expires_at,
      viewer_member.role as viewer_role,
      viewer_member.status as viewer_status
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
    collaboration.id as collaboration_id,
    collaboration.cover_image_url,
    collaboration.created_at,
    collaboration.description,
    collaboration.invite_expires_at,
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
    collaboration.split_locked_at,
    collaboration.status,
    collaboration.ticker,
    collaboration.title,
    (
      collaboration.viewer_status = 'invited'
      and collaboration.owner_id <> input_profile_id
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

grant execute on function public.create_collaboration_coin_invite(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  integer,
  bigint
) to anon, authenticated;

grant execute on function public.respond_to_collaboration_coin_invite(
  uuid,
  uuid,
  text
) to anon, authenticated;

grant execute on function public.list_profile_collaborations(
  uuid,
  boolean
) to anon, authenticated;
