import {
  BookmarkIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  EllipsisHorizontalIcon,
  HeartIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { Card, Image } from "@/components/Shared/UI";
import { DEFAULT_AVATAR } from "@/data/constants";
import formatRelativeOrAbsolute from "@/helpers/datetime/formatRelativeOrAbsolute";
import formatAddress from "@/helpers/formatAddress";
import cn from "@/helpers/cn";
import nFormatter from "@/helpers/nFormatter";
import truncateByWords from "@/helpers/truncateByWords";
import type { ZoraFeedItem } from "./zoraHomeFeedConfig";

const formatUsdMetric = (value?: string) => {
  const number = Number.parseFloat(value ?? "");

  if (!Number.isFinite(number) || number <= 0) {
    return "$0";
  }

  return `$${nFormatter(number, 2)}`;
};

const formatDelta = (value?: string) => {
  const number = Number.parseFloat(value ?? "");

  if (!Number.isFinite(number)) {
    return "0%";
  }

  const absoluteValue = Math.abs(number);
  const digits = absoluteValue >= 100 ? 0 : absoluteValue >= 10 ? 1 : 2;
  const prefix = number > 0 ? "+" : number < 0 ? "-" : "";

  return `${prefix}${absoluteValue.toFixed(digits).replace(/\.0+$|(\.\d*[1-9])0+$/, "$1")}%`;
};

const getCreatorName = (item: ZoraFeedItem) => {
  const handle = item.creatorProfile?.handle;

  if (handle?.trim()) {
    return handle.startsWith("@") ? handle : `@${handle}`;
  }

  return formatAddress(item.creatorAddress ?? item.address);
};

const getCreatorAvatar = (item: ZoraFeedItem) =>
  item.creatorProfile?.avatar?.previewImage?.medium || DEFAULT_AVATAR;

const getPreviewImage = (item: ZoraFeedItem) =>
  item.mediaContent?.previewImage?.medium ||
  item.mediaContent?.previewImage?.small ||
  item.creatorProfile?.avatar?.previewImage?.medium ||
  undefined;

const getActionCounts = (item: ZoraFeedItem) => {
  const holderCount = item.uniqueHolders ?? 0;
  const commentCount = holderCount > 0 ? Math.max(1, Math.round(holderCount / 18)) : 0;
  const likeCount =
    holderCount > 0 ? Math.max(commentCount, Math.round(holderCount * 0.62)) : 0;
  const shareCount =
    commentCount > 0
      ? Math.max(1, Math.round(commentCount * 0.35))
      : Math.round(holderCount / 40);

  return {
    commentCount,
    likeCount,
    shareCount
  };
};

const MetaPill = ({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "default" | "down" | "up";
  value: string;
}) => (
  <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-[11px] dark:bg-gray-900">
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span
      className={cn(
        "font-semibold tracking-tight",
        tone === "up"
          ? "text-emerald-600 dark:text-emerald-400"
          : tone === "down"
            ? "text-rose-600 dark:text-rose-400"
            : "text-gray-950 dark:text-gray-50"
      )}
    >
      {value}
    </span>
  </div>
);

const ActionButton = ({
  count,
  Icon,
  align = "left",
  label
}: {
  count?: number;
  Icon: typeof HeartIcon;
  align?: "left" | "right";
  label: string;
}) => (
  <button
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100",
      align === "right" ? "justify-center" : undefined
    )}
    onClick={(event) => {
      event.stopPropagation();
    }}
    type="button"
  >
    <Icon className="size-4" />
    {typeof count === "number" ? (
      <span className="text-[12px] font-semibold tabular-nums">
        {nFormatter(count, 1) || "0"}
      </span>
    ) : (
      <span className="sr-only">{label}</span>
    )}
  </button>
);

const ZoraPostCard = ({
  item,
  onOpenMobileView
}: {
  item: ZoraFeedItem;
  onOpenMobileView?: () => void;
}) => {
  const previewImage = getPreviewImage(item);
  const delta = Number.parseFloat(item.marketCapDelta24h ?? "0");
  const isPositive = delta >= 0;
  const creatorName = getCreatorName(item);
  const timestamp = item.createdAt
    ? formatRelativeOrAbsolute(item.createdAt)
    : formatAddress(item.address);
  const { commentCount, likeCount, shareCount } = getActionCounts(item);
  const caption = item.description?.trim();

  return (
    <Card
      className="w-full min-w-0 max-w-full overflow-hidden px-0 py-0 md:cursor-default"
      onClick={() => {
        onOpenMobileView?.();
      }}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Image
              alt={creatorName}
              className="size-11 shrink-0 rounded-full border border-white object-cover ring-1 ring-gray-300/90 ring-offset-1 ring-offset-white dark:border-black dark:ring-gray-700 dark:ring-offset-black"
              height={44}
              src={getCreatorAvatar(item)}
              width={44}
            />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-semibold text-gray-950 dark:text-gray-50">
                  {item.symbol ? `$${item.symbol}` : "Coin"}
                </p>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                    isPositive
                      ? "bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-800"
                      : "bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:ring-rose-800"
                  )}
                >
                  <span>MC {formatUsdMetric(item.marketCap)}</span>
                </span>
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                <span className="truncate">{creatorName}</span>
                <span className="h-1 w-1 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span className="truncate">{timestamp}</span>
              </div>
            </div>
          </div>

          <button
            aria-label={`More options for ${item.name}`}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100"
            onClick={(event) => {
              event.stopPropagation();
            }}
            type="button"
          >
            <EllipsisHorizontalIcon className="size-5" />
          </button>
        </div>

        <div className="mt-3 min-w-0 max-w-full">
          <h2 className="hidden overflow-hidden text-base font-semibold tracking-tight text-gray-950 break-all [display:-webkit-box] max-w-full [-webkit-box-orient:vertical] [-webkit-line-clamp:2] dark:text-gray-50 md:block md:text-lg md:break-words md:[display:block] md:overflow-visible md:[-webkit-line-clamp:unset] md:[overflow-wrap:anywhere]">
            {item.name}
          </h2>

          {caption ? (
            <p className="mt-1 hidden max-w-full text-sm leading-6 text-gray-600 break-all dark:text-gray-300 md:block md:break-words md:[overflow-wrap:anywhere]">
              {truncateByWords(caption, 34)}
            </p>
          ) : null}
        </div>
      </div>

      {previewImage ? (
        <div className="px-4 pb-3">
          <div className="relative overflow-hidden rounded-[1.5rem] bg-gray-100 dark:bg-gray-900">
            <Image
              alt={item.name}
              className="aspect-square w-full max-w-full object-cover md:aspect-[4/3]"
              src={previewImage}
            />
          </div>
        </div>
      ) : null}

      <div className="hidden px-4 pb-3 md:block">
        <div className="flex flex-wrap gap-2">
          <MetaPill label="MCap" value={formatUsdMetric(item.marketCap)} />
          <MetaPill label="Vol" value={formatUsdMetric(item.volume24h)} />
          <MetaPill
            label="Holders"
            value={nFormatter(item.uniqueHolders ?? 0, 2) || "0"}
          />
          <MetaPill
            label="24h"
            tone={isPositive ? "up" : "down"}
            value={formatDelta(item.marketCapDelta24h)}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="truncate">{formatAddress(item.address)} on Base</span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 font-semibold",
              isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            )}
          >
            {isPositive ? (
              <ArrowTrendingUpIcon className="size-3.5" />
            ) : (
              <ArrowTrendingDownIcon className="size-3.5" />
            )}
            <span>{formatDelta(item.marketCapDelta24h)}</span>
          </span>
        </div>
      </div>

      <div className="border-gray-200 border-t px-2 py-2 dark:border-gray-800">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <ActionButton count={likeCount} Icon={HeartIcon} label="Like" />
            <ActionButton
              count={commentCount}
              Icon={ChatBubbleOvalLeftEllipsisIcon}
              label="Comment"
            />
            <ActionButton
              count={shareCount}
              Icon={PaperAirplaneIcon}
              label="Share"
            />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 md:hidden">
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold text-gray-950 dark:text-gray-50">
                  {nFormatter(item.uniqueHolders ?? 0, 1) || "0"}
                </span>
                <span>H</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold text-gray-950 dark:text-gray-50">
                  {formatUsdMetric(item.volume24h)}
                </span>
                <span>V</span>
              </span>
            </div>
            <ActionButton Icon={BookmarkIcon} align="right" label="Save" />
          </div>
        </div>
      </div>

      <div className="min-w-0 max-w-full px-4 pb-4 md:hidden">
        <div className="max-w-full overflow-hidden text-[13px] leading-5 text-gray-600 break-all dark:text-gray-300">
          <span className="mr-1 font-semibold text-gray-950 dark:text-gray-50">
            {creatorName}
          </span>
          <span className="[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {caption ? truncateByWords(caption, 24) : item.name}
          </span>
        </div>

      </div>
    </Card>
  );
};

export default ZoraPostCard;
