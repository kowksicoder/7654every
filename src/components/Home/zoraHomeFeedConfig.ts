import { HomeFeedType } from "@/data/enums";
import type { PlatformDiscoverCoin } from "@/helpers/platformDiscovery";

export const ZORA_HOME_FEED_QUERY_KEY = "zora-home-feed";

export type ZoraFeedItem = PlatformDiscoverCoin;

interface ZoraHomeFeedConfigItem {
  emptyMessage: string;
  errorTitle: string;
  label: string;
}

export const zoraHomeFeedConfig: Record<HomeFeedType, ZoraHomeFeedConfigItem> =
  {
    [HomeFeedType.ALL]: {
      emptyMessage: "No creator posts yet!",
      errorTitle: "Failed to load creator posts",
      label: "All"
    },
    [HomeFeedType.FOLLOWING]: {
      emptyMessage: "No music creator posts yet!",
      errorTitle: "Failed to load music creator posts",
      label: "Music"
    },
    [HomeFeedType.HIGHLIGHTS]: {
      emptyMessage: "No movie creator posts yet!",
      errorTitle: "Failed to load movie creator posts",
      label: "Movies"
    },
    [HomeFeedType.FORYOU]: {
      emptyMessage: "No art creator posts yet!",
      errorTitle: "Failed to load art creator posts",
      label: "Art"
    },
    [HomeFeedType.SPORTS]: {
      emptyMessage: "No sports creator posts yet!",
      errorTitle: "Failed to load sports creator posts",
      label: "Sports"
    },
    [HomeFeedType.LIFESTYLE]: {
      emptyMessage: "No lifestyle creator posts yet!",
      errorTitle: "Failed to load lifestyle creator posts",
      label: "Lifestyle"
    },
    [HomeFeedType.POP_CULTURE]: {
      emptyMessage: "No pop-culture creator posts yet!",
      errorTitle: "Failed to load pop-culture creator posts",
      label: "Pop-Culture"
    },
    [HomeFeedType.PODCASTS]: {
      emptyMessage: "No podcast creator posts yet!",
      errorTitle: "Failed to load podcast creator posts",
      label: "Podcasts"
    },
    [HomeFeedType.PHOTOGRAPHY]: {
      emptyMessage: "No photography creator posts yet!",
      errorTitle: "Failed to load photography creator posts",
      label: "Photography"
    },
    [HomeFeedType.FOOD]: {
      emptyMessage: "No food creator posts yet!",
      errorTitle: "Failed to load food creator posts",
      label: "Food"
    },
    [HomeFeedType.WRITERS]: {
      emptyMessage: "No writer creator posts yet!",
      errorTitle: "Failed to load writer creator posts",
      label: "Writers"
    },
    [HomeFeedType.COMMUNITIES]: {
      emptyMessage: "No community creator posts yet!",
      errorTitle: "Failed to load community creator posts",
      label: "Communities"
    },
    [HomeFeedType.COLLABORATIONS]: {
      emptyMessage: "No collaboration coins are live yet!",
      errorTitle: "Failed to load collaboration coins",
      label: "Collaboration"
    },
    [HomeFeedType.COMEDIANS]: {
      emptyMessage: "No comedian creator posts yet!",
      errorTitle: "Failed to load comedian creator posts",
      label: "Comedians"
    }
  };
