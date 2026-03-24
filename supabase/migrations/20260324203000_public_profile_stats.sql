create or replace function public.get_public_profile_stats(
  input_profile_id uuid default null,
  input_wallet_address text default null,
  input_username text default null
)
returns table (
  profile_id uuid,
  creator_coin_address text,
  creator_coin_ticker text,
  referral_coin_rewards numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with target_profile as (
    select profile.id, profile.wallet_address, profile.username, profile.zora_handle
    from public.profiles profile
    where (
      input_profile_id is not null
      and profile.id = input_profile_id
    ) or (
      input_wallet_address is not null
      and (
        lower(coalesce(profile.wallet_address, '')) = lower(trim(input_wallet_address))
        or lower(coalesce(profile.lens_account_address, '')) = lower(trim(input_wallet_address))
      )
    ) or (
      input_username is not null
      and (
        lower(coalesce(profile.username, '')) = lower(trim(both '@' from input_username))
        or lower(coalesce(profile.zora_handle, '')) = lower(trim(both '@' from input_username))
      )
    )
    order by case when input_profile_id is not null and profile.id = input_profile_id then 0 else 1 end
    limit 1
  ),
  latest_launch as (
    select
      lower(nullif(trim(launch.coin_address), '')) as coin_address,
      lower(nullif(trim(launch.ticker), '')) as ticker
    from public.creator_launches launch
    inner join target_profile
      on target_profile.id = launch.created_by
    where nullif(trim(launch.coin_address), '') is not null
    order by coalesce(launch.launched_at, launch.created_at) desc
    limit 1
  ),
  referral_rewards as (
    select coalesce(sum(reward.reward_amount), 0) as reward_total
    from public.referral_trade_rewards reward
    inner join target_profile
      on target_profile.id = reward.referrer_id
  )
  select
    target_profile.id,
    latest_launch.coin_address,
    latest_launch.ticker,
    coalesce(referral_rewards.reward_total, 0)
  from target_profile
  left join latest_launch
    on true
  left join referral_rewards
    on true;
$$;

grant execute on function public.get_public_profile_stats(uuid, text, text) to anon, authenticated;

comment on function public.get_public_profile_stats(uuid, text, text) is
  'Returns public profile-level stat inputs such as the latest launched creator coin address and real referral reward earnings.';
