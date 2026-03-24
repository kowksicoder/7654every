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
  current_campaign_slug text;
  current_campaign_state text;
  current_campaign_title text;
  current_creator_name text;
  current_reward_pool_label text;
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
    current_campaign_slug := lower(trim(coalesce(campaign->>'slug', '')));
    current_campaign_state := lower(trim(coalesce(campaign->>'state', 'live')));
    current_campaign_title := nullif(trim(coalesce(campaign->>'title', '')), '');
    current_creator_name := nullif(trim(coalesce(campaign->>'creatorName', '')), '');
    current_reward_pool_label := nullif(trim(coalesce(campaign->>'rewardPoolLabel', '')), '');

    if current_campaign_slug = ''
      or current_campaign_title is null
      or current_campaign_state = 'ended' then
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
      current_campaign_slug,
      current_campaign_title,
      current_creator_name,
      current_reward_pool_label
    )
    on conflict (profile_id, campaign_slug) do nothing;

    if found then
      created_notification_id := public.create_notification(
        input_profile_id,
        null,
        'mission',
        format('New FanDrop live: %s', current_campaign_title),
        format(
          '%s just opened a FanDrop with %s up for grabs. Jump in before the window closes.',
          coalesce(current_creator_name, 'A creator'),
          coalesce(current_reward_pool_label, 'a live reward pool')
        ),
        null,
        format('fandrop:%s', current_campaign_slug),
        jsonb_build_object(
          'creatorName',
          current_creator_name,
          'deliveryKind',
          'fandrop_new',
          'rewardPoolLabel',
          current_reward_pool_label,
          'slug',
          current_campaign_slug,
          'title',
          current_campaign_title
        )
      );

      update public.profile_fandrop_notification_deliveries delivery
      set notification_id = created_notification_id
      where delivery.profile_id = input_profile_id
        and delivery.campaign_slug = current_campaign_slug;

      created_count := created_count + 1;
      delivered_campaign_slugs :=
        delivered_campaign_slugs || to_jsonb(current_campaign_slug);
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
