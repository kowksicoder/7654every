import {
  ArrowTrendingUpIcon,
  FireIcon,
  SparklesIcon
} from "@heroicons/react/24/outline";
import { setApiKey } from "@zoralabs/coins-sdk";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Fragment, useCallback, useMemo, useState } from "react";
import { EmptyState, ErrorMessage, Spinner } from "@/components/Shared/UI";
import { HomeFeedType } from "@/data/enums";
import getZoraApiKey from "@/helpers/getZoraApiKey";
import useLoadMoreOnIntersect from "@/hooks/useLoadMoreOnIntersect";
import { useHomeTabStore } from "@/store/persisted/useHomeTabStore";
import ZoraPostCard from "./ZoraPostCard";
import ZoraFeedShimmer from "./ZoraFeedShimmer";
import ZoraPostMobileViewer from "./ZoraPostMobileViewer";
import WhoToFollowFeedBlock from "./WhoToFollowFeedBlock";
import {
  ZORA_HOME_FEED_QUERY_KEY,
  zoraHomeFeedConfig,
  type ZoraFeedItem
} from "./zoraHomeFeedConfig";

const zoraApiKey = getZoraApiKey();

if (zoraApiKey) {
  setApiKey(zoraApiKey);
}

interface ZoraFeedPage {
  items: ZoraFeedItem[];
  nextCursor?: string;
}

const getEmptyIcon = (feedType: HomeFeedType) => {
  if (feedType === HomeFeedType.HIGHLIGHTS) {
    return <SparklesIcon className="size-8" />;
  }

  if (feedType === HomeFeedType.FORYOU) {
    return <ArrowTrendingUpIcon className="size-8" />;
  }

  return <FireIcon className="size-8" />;
};

const ZoraFeed = () => {
  const { feedType } = useHomeTabStore();
  const currentFeed = zoraHomeFeedConfig[feedType];
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useInfiniteQuery<ZoraFeedPage, Error>({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!zoraApiKey) {
        throw new Error("Missing Zora API key for the Zora feed.");
      }

      const response = await currentFeed.query({
        after: pageParam as string | undefined,
        count: 20
      });
      const edges = response.data?.exploreList?.edges ?? [];
      const pageInfo = response.data?.exploreList?.pageInfo;

      return {
        items: edges
          .map((edge) => edge.node)
          .filter(
            (item) =>
              !item.platformBlocked && !item.creatorProfile?.platformBlocked
          ),
        nextCursor: pageInfo?.hasNextPage ? pageInfo.endCursor : undefined
      };
    },
    queryKey: [ZORA_HOME_FEED_QUERY_KEY, feedType],
    staleTime: 30_000
  });

  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data?.pages]
  );

  const suggestions = useMemo(() => {
    const seen = new Set<string>();

    return items.filter((item) => {
      const key =
        item.creatorProfile?.handle?.toLowerCase() ||
        item.creatorAddress?.toLowerCase() ||
        item.address.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return Boolean(item.creatorProfile?.avatar?.previewImage?.medium || item.mediaContent?.previewImage?.medium);
    });
  }, [items]);

  const getSuggestionStartIndex = useCallback(
    (index: number) => {
      if (!suggestions.length) {
        return 0;
      }

      return (Math.floor(index / 3) * 4) % suggestions.length;
    },
    [suggestions.length]
  );

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const loadMoreRef = useLoadMoreOnIntersect(handleLoadMore);
  const handleOpenMobileView = useCallback((index: number) => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches) {
      return;
    }

    setSelectedPostIndex(index);
  }, []);

  if (isLoading) {
    return <ZoraFeedShimmer />;
  }

  if (error) {
    return <ErrorMessage error={error} title={currentFeed.errorTitle} />;
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={getEmptyIcon(feedType)}
        message={currentFeed.emptyMessage}
      />
    );
  }

  return (
    <>
      <section className="min-w-0 overflow-x-hidden space-y-3 pb-5">
        {items.map((item, index) => (
          <Fragment key={item.id}>
            <ZoraPostCard
              item={item}
              onOpenMobileView={() => handleOpenMobileView(index)}
            />
            {(index + 1) % 3 === 0 && suggestions.length >= 4 ? (
              <WhoToFollowFeedBlock
                startIndex={getSuggestionStartIndex(index)}
                suggestions={suggestions}
              />
            ) : null}
          </Fragment>
        ))}

        {hasNextPage ? (
          <div className="flex justify-center px-5 py-4 md:px-0">
            <span ref={loadMoreRef} />
            {isFetchingNextPage ? <Spinner size="sm" /> : null}
          </div>
        ) : null}
      </section>

      <ZoraPostMobileViewer
        hasNextPage={Boolean(hasNextPage)}
        initialIndex={selectedPostIndex ?? 0}
        isFetchingMore={isFetchingNextPage}
        items={selectedPostIndex !== null ? items : []}
        onClose={() => setSelectedPostIndex(null)}
        onRequestMore={handleLoadMore}
      />
    </>
  );
};

export default ZoraFeed;
