import {
  getCoinsTopGainers,
  getExploreNewAll,
  getExploreTopVolumeAll24h,
  type ExploreResponse,
  type QueryRequestType
} from "@zoralabs/coins-sdk";
import { HomeFeedType } from "@/data/enums";

export const ZORA_HOME_FEED_QUERY_KEY = "zora-home-feed";

export type ZoraFeedItem = NonNullable<
  NonNullable<NonNullable<ExploreResponse["data"]>["exploreList"]>["edges"][number]["node"]
>;

type ZoraFeedQuery = (
  query?: QueryRequestType
) => Promise<ExploreResponse>;

interface ZoraHomeFeedConfigItem {
  emptyMessage: string;
  errorTitle: string;
  label: string;
  query: ZoraFeedQuery;
}

export const zoraHomeFeedConfig: Record<HomeFeedType, ZoraHomeFeedConfigItem> = {
  [HomeFeedType.FOLLOWING]: {
    emptyMessage: "No active Zora posts yet!",
    errorTitle: "Failed to load active Zora posts",
    label: "Active",
    query: getExploreTopVolumeAll24h
  },
  [HomeFeedType.HIGHLIGHTS]: {
    emptyMessage: "No fresh Zora posts yet!",
    errorTitle: "Failed to load fresh Zora posts",
    label: "Fresh",
    query: getExploreNewAll
  },
  [HomeFeedType.FORYOU]: {
    emptyMessage: "No gaining Zora posts yet!",
    errorTitle: "Failed to load top gainers",
    label: "Top Gainers",
    query: getCoinsTopGainers
  }
};
