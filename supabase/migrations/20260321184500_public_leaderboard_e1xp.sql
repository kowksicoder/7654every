create or replace function public.get_public_profile_e1xp_by_wallets(
  input_wallet_addresses text[]
)
returns table (
  wallet_address text,
  total_e1xp bigint
)
language sql
security definer
set search_path = public
as $$
  with requested_wallets as (
    select distinct lower(trim(wallet)) as wallet_address
    from unnest(coalesce(input_wallet_addresses, array[]::text[])) as wallet
    where nullif(trim(wallet), '') is not null
  )
  select
    profile.wallet_address,
    coalesce(sum(ledger.amount), 0)::bigint as total_e1xp
  from requested_wallets requested
  join public.profiles profile
    on lower(profile.wallet_address) = requested.wallet_address
  left join public.e1xp_ledger ledger
    on ledger.profile_id = profile.id
  group by profile.wallet_address
  order by total_e1xp desc, profile.wallet_address asc;
$$;

grant execute on function public.get_public_profile_e1xp_by_wallets(text[]) to anon, authenticated;

comment on function public.get_public_profile_e1xp_by_wallets(text[]) is
  'Returns public E1XP totals for the supplied wallet addresses so public leaderboards can render real rewards stats.';
