import { useQuery } from "@tanstack/react-query";
import { type GetCoinResponse, getCoin, setApiKey } from "@zoralabs/coins-sdk";
import type { Address } from "viem";
import { base } from "viem/chains";
import { ZORA_API_KEY } from "@/data/constants";
import getAccount from "@/helpers//getAccount";
import {
  EVERY1_PUBLIC_PROFILE_STATS_QUERY_KEY,
  getPublicProfileStats
} from "@/helpers/every1";
import getAccountAttribute from "@/helpers/getAccountAttribute";
import humanize from "@/helpers/humanize";
import { formatUsdMetric } from "@/helpers/liveCreatorData";
import type { AccountFragment } from "@/indexer/generated";

interface FolloweringsProps {
  account: AccountFragment;
  e1xpTotal?: number;
}

setApiKey(ZORA_API_KEY);

const Followerings = ({ account, e1xpTotal = 0 }: FolloweringsProps) => {
  const accountInfo = getAccount(account);
  const creatorCoinAttribute = getAccountAttribute(
    "creatorCoinAddress",
    account?.metadata?.attributes
  );

  const profileStatsQuery = useQuery({
    queryFn: async () =>
      await getPublicProfileStats({
        username: accountInfo.username,
        walletAddress: account.owner || account.address
      }),
    queryKey: [
      EVERY1_PUBLIC_PROFILE_STATS_QUERY_KEY,
      account.address,
      account.owner || null,
      accountInfo.username
    ]
  });

  const creatorCoinAddress =
    creatorCoinAttribute || profileStatsQuery.data?.creatorCoinAddress || null;

  const { data: creatorCoin, isLoading: loadingCreatorCoin } = useQuery<
    GetCoinResponse["zora20Token"] | null
  >({
    enabled: Boolean(creatorCoinAddress),
    queryFn: async () => {
      const coin = await getCoin({
        address: creatorCoinAddress as Address,
        chain: base.id
      });

      return coin.data?.zora20Token ?? null;
    },
    queryKey: ["profile-creator-coin-stats", creatorCoinAddress]
  });

  if (
    profileStatsQuery.isLoading ||
    (creatorCoinAddress && loadingCreatorCoin)
  ) {
    return (
      <div className="grid grid-cols-3 overflow-hidden rounded-[1.1rem] border border-gray-200 bg-gray-50/90 sm:grid-cols-5 dark:border-white/10 dark:bg-white/[0.05]">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            className="h-13 animate-pulse bg-white dark:bg-white/[0.06]"
            key={index}
            style={
              index === 0
                ? undefined
                : { borderLeft: "1px solid rgba(148,163,184,0.18)" }
            }
          />
        ))}
      </div>
    );
  }

  const marketCapValue = Number.parseFloat(creatorCoin?.marketCap ?? "0");
  const volume24hValue = Number.parseFloat(creatorCoin?.volume24h ?? "0");
  const totalSupplyValue = Number.parseFloat(creatorCoin?.totalSupply ?? "0");
  const priceValue =
    Number.isFinite(marketCapValue) &&
    marketCapValue > 0 &&
    Number.isFinite(totalSupplyValue) &&
    totalSupplyValue > 0
      ? marketCapValue / totalSupplyValue
      : 0;
  const earningsValue = profileStatsQuery.data?.referralCoinRewards ?? 0;
  const hasCreatorCoin = Boolean(creatorCoinAddress && creatorCoin);

  const formatCoinMetric = (value: number, digits = 2) =>
    hasCreatorCoin ? formatUsdMetric(value, digits) : "--";

  const StatCell = ({ label, value }: { label: string; value: string }) => {
    return (
      <div className="flex min-h-[3rem] flex-col justify-center px-1.5 py-1.5 text-center transition hover:bg-gray-100/90 sm:min-h-[3.25rem] dark:hover:bg-white/[0.03]">
        <div className="truncate font-semibold text-[0.88rem] text-gray-950 leading-none sm:text-[0.98rem] dark:text-white">
          {value}
        </div>
        <div className="mt-0.5 text-[8px] text-gray-500 uppercase tracking-[0.08em] sm:text-[9px] dark:text-white/[0.55]">
          {label}
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-[1.1rem] border border-gray-200 bg-gray-50/90 backdrop-blur dark:border-white/10 dark:bg-white/[0.05]">
      <div className="grid grid-cols-3 divide-x divide-y divide-gray-200 sm:grid-cols-5 sm:divide-y-0 dark:divide-white/10">
        <StatCell label="E1XP" value={humanize(e1xpTotal)} />
        <StatCell label="MC" value={formatCoinMetric(marketCapValue)} />
        <StatCell label="Earnings" value={formatUsdMetric(earningsValue)} />
        <StatCell label="Price" value={formatCoinMetric(priceValue, 4)} />
        <StatCell label="Volume" value={formatCoinMetric(volume24hValue)} />
      </div>
    </div>
  );
};

export default Followerings;
