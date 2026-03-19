import { Transition, TransitionChild } from "@headlessui/react";
import { getCoinComments, type GetCoinCommentsResponse } from "@zoralabs/coins-sdk";
import { useQuery } from "@tanstack/react-query";
import { Fragment, memo } from "react";
import { Spinner } from "@/components/Shared/UI";
import { DEFAULT_AVATAR } from "@/data/constants";
import formatRelativeOrAbsolute from "@/helpers/datetime/formatRelativeOrAbsolute";
import formatAddress from "@/helpers/formatAddress";
import type { ZoraFeedItem } from "./zoraHomeFeedConfig";

type CommentNode = NonNullable<
  NonNullable<
    NonNullable<GetCoinCommentsResponse["zora20Token"]>["zoraComments"]
  >["edges"]
>[number]["node"];

const getCommentAvatar = (comment: CommentNode) =>
  comment?.userProfile?.avatar?.previewImage?.small ||
  comment?.userProfile?.avatar?.previewImage?.medium ||
  DEFAULT_AVATAR;

const getCommentAuthor = (comment: CommentNode) => {
  const handle = comment?.userProfile?.handle;

  if (handle?.trim()) {
    return handle.startsWith("@") ? handle : `@${handle}`;
  }

  return formatAddress(comment?.userAddress);
};

const formatCommentTimestamp = (timestamp?: number | string | null) => {
  if (!timestamp) {
    return "now";
  }

  const parsedTimestamp =
    typeof timestamp === "number"
      ? new Date(timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp)
      : new Date(timestamp);

  if (Number.isNaN(parsedTimestamp.getTime())) {
    return "now";
  }

  return formatRelativeOrAbsolute(parsedTimestamp.toISOString());
};

interface ZoraPostCommentsDrawerProps {
  item: ZoraFeedItem | null;
  onClose: () => void;
  show: boolean;
}

const ZoraPostCommentsDrawer = ({
  item,
  onClose,
  show
}: ZoraPostCommentsDrawerProps) => {
  const { data, isLoading } = useQuery({
    enabled: show && Boolean(item?.address),
    queryFn: async () => {
      if (!item?.address) {
        return { comments: [] as CommentNode[], count: 0 };
      }

      const response = await getCoinComments({
        address: item.address,
        count: 20
      });

      const comments =
        response.data?.zora20Token?.zoraComments?.edges?.flatMap((edge) =>
          edge?.node ? [edge.node] : []
        ) ?? [];

      return {
        comments,
        count: response.data?.zora20Token?.zoraComments?.count ?? comments.length
      };
    },
    queryKey: ["zora-post-comments", item?.address]
  });

  const comments = data?.comments ?? [];
  const count = data?.count ?? comments.length;

  return (
    <Transition as={Fragment} show={show}>
      <div className="absolute inset-0 z-40">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <button
            aria-label="Close comments"
            className="absolute inset-0 bg-black/35"
            onClick={onClose}
            type="button"
          />
        </TransitionChild>

        <TransitionChild
          as={Fragment}
          enter="ease-out duration-250"
          enterFrom="translate-y-full"
          enterTo="translate-y-0"
          leave="ease-in duration-200"
          leaveFrom="translate-y-0"
          leaveTo="translate-y-full"
        >
          <div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-hidden rounded-t-[1.75rem] bg-white text-gray-950 shadow-2xl dark:bg-gray-950 dark:text-gray-50">
            <div className="flex justify-center pt-2.5">
              <span className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>

            <div className="border-gray-200 border-b px-5 pt-3 pb-4 text-center dark:border-gray-800">
              <p className="text-sm font-semibold">
                Comments {count ? `(${count})` : ""}
              </p>
            </div>

            <div className="max-h-[calc(78vh-8.75rem)] overflow-y-auto px-4 py-3">
              {isLoading ? (
                <div className="flex h-28 items-center justify-center">
                  <Spinner size="sm" />
                </div>
              ) : comments.length ? (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div className="flex items-start gap-3" key={comment?.commentId ?? comment?.nonce}>
                      <img
                        alt={getCommentAuthor(comment)}
                        className="mt-0.5 size-9 shrink-0 rounded-full object-cover"
                        src={getCommentAvatar(comment)}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold">
                            {getCommentAuthor(comment)}
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {formatCommentTimestamp(comment?.timestamp)}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] leading-5 text-gray-700 break-words [overflow-wrap:anywhere] dark:text-gray-300">
                          {comment?.comment || "No text"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-28 flex-col items-center justify-center text-center">
                  <p className="text-sm font-semibold">No comments yet</p>
                  <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
                    Be the first to start the conversation.
                  </p>
                </div>
              )}
            </div>

            <div className="border-gray-200 border-t px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] dark:border-gray-800">
              <div className="flex items-center gap-3 rounded-full bg-gray-100 px-4 py-3 dark:bg-gray-900">
                <span className="size-8 rounded-full bg-gray-300 dark:bg-gray-700" />
                <span className="text-[13px] text-gray-500 dark:text-gray-400">
                  Add a comment...
                </span>
              </div>
            </div>
          </div>
        </TransitionChild>
      </div>
    </Transition>
  );
};

export default memo(ZoraPostCommentsDrawer);
