import {
  type GetFeaturedCreatorsResponse,
  type GetProfileCoinsResponse,
  type GetProfileResponse,
  type GetTraderLeaderboardResponse,
  getFeaturedCreators,
  getProfile,
  getProfileCoins,
  getTraderLeaderboard,
  setApiKey
} from "@zoralabs/coins-sdk";
import dayjs from "dayjs";
import { DEFAULT_AVATAR } from "@/data/constants";
import { getPublicE1xpTotalsByWallets } from "@/helpers/every1";
import formatAddress from "@/helpers/formatAddress";
import getZoraApiKey from "@/helpers/getZoraApiKey";
import nFormatter from "@/helpers/nFormatter";

const zoraApiKey = getZoraApiKey();

if (zoraApiKey) {
  setApiKey(zoraApiKey);
}

type FeaturedCreatorNode = NonNullable<
  NonNullable<
    GetFeaturedCreatorsResponse["traderLeaderboardFeaturedCreators"]
  >["edges"][number]["node"]
>;

type ProfileNode = NonNullable<GetProfileResponse["profile"]>;

type ProfileCoinNode = NonNullable<
  NonNullable<
    NonNullable<GetProfileCoinsResponse["profile"]>["createdCoins"]
  >["edges"][number]["node"]
>;

type TraderLeaderboardNode = NonNullable<
  NonNullable<
    GetTraderLeaderboardResponse["exploreTraderLeaderboard"]
  >["edges"][number]["node"]
>;

export interface FeaturedCreatorEntry {
  address: string;
  avatar: string;
  createdAt: string | undefined;
  handle: string;
  marketCap: string;
  marketCapDelta24h: string;
  name: string;
  symbol: string;
  uniqueHolders: number;
  volume24h: string;
}

export interface TraderLeaderboardEntry {
  address?: string;
  avatar: string;
  displayName: string;
  e1xpTotal: number;
  grossVolumeZora: number;
  handle: string;
  id: string;
  score: number;
  weekTradesCount: number;
  weekVolumeUsd: number;
}

const getProfileDisplayName = (profile: ProfileNode | null | undefined) =>
  profile?.displayName?.trim() ||
  profile?.username?.trim() ||
  profile?.handle?.trim() ||
  "";

const getProfileAvatar = (profile: ProfileNode | null | undefined) =>
  profile?.avatar?.medium || DEFAULT_AVATAR;

const findCreatorCoin = (
  profile: ProfileNode | null | undefined,
  coins: ProfileCoinNode[]
) => {
  const creatorCoinAddress = profile?.creatorCoin?.address?.toLowerCase();

  if (!coins.length) {
    return null;
  }

  if (!creatorCoinAddress) {
    return coins[0];
  }

  return (
    coins.find((coin) => coin.address.toLowerCase() === creatorCoinAddress) ||
    coins[0]
  );
};

export const fetchFeaturedCreatorEntries = async (count = 12) => {
  if (!zoraApiKey) {
    throw new Error("Missing Zora API key for featured creators.");
  }

  const featuredResponse = await getFeaturedCreators({ first: count });
  const featuredNodes =
    featuredResponse.data?.traderLeaderboardFeaturedCreators?.edges?.map(
      (edge) => edge.node
    ) ?? [];

  const uniqueHandles = Array.from(
    new Set(
      featuredNodes
        .map((node: FeaturedCreatorNode) => node.handle?.trim())
        .filter(Boolean)
    )
  );

  const entries = await Promise.all(
    uniqueHandles.map(async (identifier) => {
      try {
        const [profileResponse, profileCoinsResponse] = await Promise.all([
          getProfile({ identifier }),
          getProfileCoins({ count: 20, identifier })
        ]);

        const profile = profileResponse.data?.profile;
        const createdCoins =
          profileCoinsResponse.data?.profile?.createdCoins?.edges
            ?.map((edge) => edge.node)
            .filter(Boolean) ?? [];
        const creatorCoin = findCreatorCoin(profile, createdCoins);

        if (
          !profile ||
          profile.platformBlocked ||
          !creatorCoin ||
          creatorCoin.platformBlocked
        ) {
          return null;
        }

        return {
          address: creatorCoin.address,
          avatar:
            profile.avatar?.medium ||
            creatorCoin.mediaContent?.previewImage?.medium ||
            creatorCoin.mediaContent?.previewImage?.small ||
            DEFAULT_AVATAR,
          createdAt: creatorCoin.createdAt,
          handle: profile.handle.startsWith("@")
            ? profile.handle
            : `@${profile.handle}`,
          marketCap: creatorCoin.marketCap,
          marketCapDelta24h:
            creatorCoin.marketCapDelta24h ||
            profile.creatorCoin?.marketCapDelta24h ||
            "0",
          name:
            getProfileDisplayName(profile) ||
            creatorCoin.name ||
            formatAddress(profile.publicWallet.walletAddress),
          symbol: creatorCoin.symbol,
          uniqueHolders: creatorCoin.uniqueHolders,
          volume24h: creatorCoin.volume24h
        } satisfies FeaturedCreatorEntry;
      } catch {
        return null;
      }
    })
  );

  return entries.filter(
    (
      entry
    ): entry is {
      address: string;
      avatar: string;
      createdAt: string | undefined;
      handle: string;
      marketCap: string;
      marketCapDelta24h: string;
      name: string;
      symbol: string;
      uniqueHolders: number;
      volume24h: string;
    } => entry !== null
  );
};

export const fetchTraderLeaderboardEntries = async (count = 20) => {
  if (!zoraApiKey) {
    throw new Error("Missing Zora API key for trader leaderboard.");
  }

  const leaderboardResponse = await getTraderLeaderboard({ first: count });
  const leaderboardNodes =
    leaderboardResponse.data?.exploreTraderLeaderboard?.edges?.map(
      (edge) => edge.node
    ) ?? [];

  const profiles = await Promise.all(
    leaderboardNodes.map(async (node: TraderLeaderboardNode) => {
      const identifier = node.traderProfile?.handle?.trim();

      if (!identifier) {
        return null;
      }

      try {
        const profileResponse = await getProfile({ identifier });
        return profileResponse.data?.profile ?? null;
      } catch {
        return null;
      }
    })
  );

  const entries = leaderboardNodes.map((node: TraderLeaderboardNode, index) => {
    const profile = profiles[index];
    const walletAddress = profile?.publicWallet.walletAddress;

    return {
      address: walletAddress,
      avatar: getProfileAvatar(profile),
      displayName:
        getProfileDisplayName(profile) ||
        node.entityName ||
        node.traderProfile?.handle ||
        "Unknown trader",
      e1xpTotal: 0,
      grossVolumeZora: node.weekGrossVolumeZora,
      handle: profile?.handle
        ? profile.handle.startsWith("@")
          ? profile.handle
          : `@${profile.handle}`
        : node.traderProfile?.handle
          ? node.traderProfile.handle.startsWith("@")
            ? node.traderProfile.handle
            : `@${node.traderProfile.handle}`
          : walletAddress
            ? formatAddress(walletAddress)
            : node.entityName,
      id: node.traderProfile?.id || `${node.entityName}-${index}`,
      score: node.score,
      weekTradesCount: node.weekTradesCount,
      weekVolumeUsd: node.weekVolumeUsd
    } satisfies TraderLeaderboardEntry;
  });

  let e1xpTotalsByWallet: Record<string, number> = {};

  try {
    e1xpTotalsByWallet = await getPublicE1xpTotalsByWallets(
      entries
        .map((entry) => entry.address)
        .filter((address): address is string => Boolean(address))
    );
  } catch {
    e1xpTotalsByWallet = {};
  }

  return entries.map((entry) => ({
    ...entry,
    e1xpTotal: entry.address
      ? e1xpTotalsByWallet[entry.address.toLowerCase()] || 0
      : 0
  }));
};

export const parseMetricNumber = (value?: number | string | null) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number.parseFloat(value ?? "");

  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatUsdMetric = (value?: number | string | null, digits = 2) => {
  const amount = parseMetricNumber(value);

  if (amount <= 0) {
    return "$0";
  }

  return `$${nFormatter(amount, digits)}`;
};

export const formatCompactMetric = (
  value?: number | string | null,
  digits = 1
) => {
  const amount = parseMetricNumber(value);

  if (amount <= 0) {
    return "0";
  }

  return nFormatter(amount, digits);
};

export const formatDelta = (value?: number | string | null) => {
  const amount = parseMetricNumber(value);
  const absoluteValue = Math.abs(amount);
  const precision = absoluteValue >= 100 ? 0 : absoluteValue >= 10 ? 1 : 2;
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";

  return `${prefix}${absoluteValue.toFixed(precision).replace(/\.0+$|(\.\d*[1-9])0+$/, "$1")}%`;
};

export const isPositiveDelta = (value?: number | string | null) =>
  parseMetricNumber(value) >= 0;

export const getFeaturedCreatorAge = (createdAt?: string) => {
  const createdDate = createdAt ? dayjs(createdAt) : null;

  if (!createdDate?.isValid()) {
    return "--";
  }

  const now = dayjs();
  const diffInDays = now.diff(createdDate, "day");

  if (diffInDays < 1) {
    return "today";
  }

  if (diffInDays < 7) {
    return `${diffInDays}d`;
  }

  if (diffInDays < 30) {
    return `${Math.floor(diffInDays / 7)}w`;
  }

  if (diffInDays < 365) {
    return `${Math.floor(diffInDays / 30)}mo`;
  }

  return `${Math.floor(diffInDays / 365)}y`;
};

export const getCreatorTicker = (symbol?: string) =>
  symbol?.trim() ? `\u20A6${symbol.trim()}` : "";
