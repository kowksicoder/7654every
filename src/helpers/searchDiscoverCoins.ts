import { DEFAULT_AVATAR } from "@/data/constants";
import {
  fetchPlatformDiscoverCoins,
  type PlatformDiscoverCoin
} from "@/helpers/platformDiscovery";

export interface SearchDiscoverCoin {
  address: string;
  createdAt?: string;
  creatorAddress?: null | string;
  creatorDisplayName?: null | string;
  creatorHandle?: null | string;
  imageUrl: string;
  isPlatformCreated?: boolean;
  marketCap?: null | string;
  marketCapDelta24h?: null | string;
  name: string;
  symbol: string;
  uniqueHolders?: null | number;
  volume24h?: null | string;
}

const normalizeText = (value?: null | string) =>
  value?.trim().toLowerCase().replace(/\s+/g, " ") || "";

const parseMetric = (value?: null | number | string) => {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));

  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCreatedAt = (value?: null | string) => {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const mapCoin = (
  item: PlatformDiscoverCoin,
  isPlatformCreated = false
): SearchDiscoverCoin => ({
  address: item.address,
  createdAt: item.createdAt,
  creatorAddress: item.creatorAddress,
  creatorDisplayName:
    item.creatorDisplayName || item.creatorProfile?.handle || null,
  creatorHandle: item.creatorProfile?.handle || null,
  imageUrl:
    item.mediaContent?.previewImage?.medium ||
    item.mediaContent?.previewImage?.small ||
    item.creatorProfile?.avatar?.previewImage?.medium ||
    DEFAULT_AVATAR,
  isPlatformCreated,
  marketCap: item.marketCap,
  marketCapDelta24h: item.marketCapDelta24h,
  name: item.name || item.symbol || item.address,
  symbol: item.symbol,
  uniqueHolders: item.uniqueHolders,
  volume24h: item.volume24h
});

const dedupeCoins = (items: SearchDiscoverCoin[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.address.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const sortByDiscoveryWeight = (items: SearchDiscoverCoin[]) =>
  [...items].sort((a, b) => {
    if (a.isPlatformCreated !== b.isPlatformCreated) {
      return a.isPlatformCreated ? -1 : 1;
    }

    const aScore =
      parseMetric(a.volume24h) * 3 +
      parseMetric(a.marketCap) +
      parseMetric(a.uniqueHolders);
    const bScore =
      parseMetric(b.volume24h) * 3 +
      parseMetric(b.marketCap) +
      parseMetric(b.uniqueHolders);

    return bScore - aScore;
  });

const scoreCoin = (coin: SearchDiscoverCoin, normalizedQuery: string) => {
  const symbol = normalizeText(coin.symbol);
  const name = normalizeText(coin.name);
  const handle = normalizeText(coin.creatorHandle);
  const creatorName = normalizeText(coin.creatorDisplayName);
  const address = normalizeText(coin.address);

  let score = 0;

  if (symbol === normalizedQuery) {
    score += 400;
  }

  if (name === normalizedQuery) {
    score += 340;
  }

  if (handle === normalizedQuery) {
    score += 260;
  }

  if (symbol.startsWith(normalizedQuery)) {
    score += 220;
  }

  if (name.startsWith(normalizedQuery)) {
    score += 200;
  }

  if (
    handle.startsWith(normalizedQuery) ||
    creatorName.startsWith(normalizedQuery)
  ) {
    score += 170;
  }

  if (symbol.includes(normalizedQuery)) {
    score += 130;
  }

  if (name.includes(normalizedQuery)) {
    score += 120;
  }

  if (
    handle.includes(normalizedQuery) ||
    creatorName.includes(normalizedQuery) ||
    address.includes(normalizedQuery)
  ) {
    score += 100;
  }

  if (coin.isPlatformCreated) {
    score += 180;
  }

  return score;
};

const fetchDiscoveryPools = async (count = 36) => {
  const platformCoins = await fetchPlatformDiscoverCoins({
    limit: Math.max(Math.min(count, 48), 12)
  }).catch(() => [] as PlatformDiscoverCoin[]);

  return platformCoins.map((item) => mapCoin(item, true));
};

export const fetchTrendingSearchCoins = async (limit = 3) => {
  const platformCoins = await fetchPlatformDiscoverCoins({
    limit: Math.max(Math.min(limit * 4, 16), 6)
  }).catch(() => [] as PlatformDiscoverCoin[]);

  return dedupeCoins(
    platformCoins
      .map((item) => mapCoin(item, true))
      .sort(
        (left, right) =>
          parseCreatedAt(right.createdAt) - parseCreatedAt(left.createdAt)
      )
  ).slice(0, limit);
};

export const searchDiscoverCoins = async (query: string, limit = 24) => {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return [] as SearchDiscoverCoin[];
  }

  const items = dedupeCoins(await fetchDiscoveryPools());
  const matches = items
    .map((item) => ({
      item,
      score: scoreCoin(item, normalizedQuery)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (a.item.isPlatformCreated !== b.item.isPlatformCreated) {
        return a.item.isPlatformCreated ? -1 : 1;
      }

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        parseCreatedAt(b.item.createdAt) - parseCreatedAt(a.item.createdAt)
      );
    })
    .map(({ item }) => item);

  return matches.slice(0, limit);
};

export const fetchSearchDiscoveryPools = async () =>
  sortByDiscoveryWeight(dedupeCoins(await fetchDiscoveryPools()));
