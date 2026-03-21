import {
  BellIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  GiftIcon,
  HeartIcon,
  SparklesIcon,
  UserPlusIcon
} from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { memo, useEffect, useMemo, useRef } from "react";
import Loader from "@/components/Shared/Loader";
import { Card, EmptyState, ErrorMessage, Image } from "@/components/Shared/UI";
import { NotificationFeedType } from "@/data/enums";
import formatRelativeOrAbsolute from "@/helpers/datetime/formatRelativeOrAbsolute";
import {
  EVERY1_NOTIFICATION_COUNT_QUERY_KEY,
  EVERY1_NOTIFICATIONS_QUERY_KEY,
  markNotificationsRead
} from "@/helpers/every1";
import useEvery1Notifications from "@/hooks/useEvery1Notifications";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import type { Every1Notification } from "@/types/every1";

interface ListProps {
  feedType: string;
}

const FEED_KIND_MAP: Record<
  NotificationFeedType,
  Every1Notification["kind"][]
> = {
  [NotificationFeedType.Activity]: [
    "comment",
    "like",
    "mission",
    "payment",
    "share",
    "streak"
  ],
  [NotificationFeedType.All]: [
    "comment",
    "like",
    "mission",
    "payment",
    "referral",
    "reward",
    "share",
    "streak",
    "system",
    "toast"
  ],
  [NotificationFeedType.Referrals]: ["referral"],
  [NotificationFeedType.Rewards]: ["reward"],
  [NotificationFeedType.System]: ["system", "toast"]
};

const kindIconMap: Record<Every1Notification["kind"], ReactNode> = {
  comment: <ChatBubbleOvalLeftEllipsisIcon className="size-5" />,
  like: <HeartIcon className="size-5" />,
  mission: <SparklesIcon className="size-5" />,
  payment: <GiftIcon className="size-5" />,
  referral: <UserPlusIcon className="size-5" />,
  reward: <GiftIcon className="size-5" />,
  share: <SparklesIcon className="size-5" />,
  streak: <SparklesIcon className="size-5" />,
  system: <BellIcon className="size-5" />,
  toast: <BellIcon className="size-5" />
};

const List = ({ feedType }: ListProps) => {
  const queryClient = useQueryClient();
  const { profile } = useEvery1Store();
  const isMarkingNotifications = useRef(false);
  const inFlightNotificationIds = useRef("");
  const lastMarkedNotificationIds = useRef("");
  const { data, error, isLoading } = useEvery1Notifications({
    limit: 80,
    refetchInterval: 15000,
    scope: feedType
  });

  const notifications = useMemo(() => {
    const allowedKinds = FEED_KIND_MAP[feedType as NotificationFeedType];
    return (data || []).filter((notification) =>
      allowedKinds.includes(notification.kind)
    );
  }, [data, feedType]);

  useEffect(() => {
    if (
      !profile?.id ||
      !notifications.length ||
      isMarkingNotifications.current
    ) {
      return;
    }

    const unreadIds = notifications
      .filter((notification) => !notification.isRead)
      .map((notification) => notification.id);
    const unreadSignature = unreadIds.join(",");

    if (
      !unreadIds.length ||
      unreadSignature === lastMarkedNotificationIds.current ||
      unreadSignature === inFlightNotificationIds.current
    ) {
      return;
    }

    isMarkingNotifications.current = true;
    inFlightNotificationIds.current = unreadSignature;

    void markNotificationsRead(profile.id, unreadIds)
      .then(async () => {
        lastMarkedNotificationIds.current = unreadSignature;
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [EVERY1_NOTIFICATIONS_QUERY_KEY, profile.id]
          }),
          queryClient.invalidateQueries({
            queryKey: [EVERY1_NOTIFICATION_COUNT_QUERY_KEY, profile.id]
          })
        ]);
      })
      .finally(() => {
        isMarkingNotifications.current = false;
        inFlightNotificationIds.current = "";
      });
  }, [notifications, profile?.id, queryClient]);

  if (isLoading && !data) {
    return <Loader className="my-10" />;
  }

  if (error) {
    return <ErrorMessage error={error} title="Failed to load notifications" />;
  }

  if (!notifications?.length) {
    return (
      <EmptyState
        icon={<BellIcon className="size-8" />}
        message="Inbox zero!"
      />
    );
  }

  return (
    <Card className="divide-y divide-gray-200 dark:divide-gray-800">
      {notifications.map((notification) => (
        <div className="flex items-start gap-3 p-5" key={notification.id}>
          <div className="relative mt-0.5 shrink-0">
            {notification.actorAvatarUrl ? (
              <Image
                alt={
                  notification.actorDisplayName ||
                  notification.actorUsername ||
                  notification.title
                }
                className="size-11 rounded-full object-cover"
                src={notification.actorAvatarUrl}
              />
            ) : (
              <div className="flex size-11 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                {kindIconMap[notification.kind]}
              </div>
            )}
            <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 dark:bg-black dark:text-gray-300 dark:ring-gray-800">
              {kindIconMap[notification.kind]}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                  {notification.title}
                </p>
                {notification.body ? (
                  <p className="mt-1 text-gray-600 text-sm dark:text-gray-400">
                    {notification.body}
                  </p>
                ) : null}
                {notification.actorDisplayName || notification.actorUsername ? (
                  <p className="mt-1 text-gray-500 text-xs dark:text-gray-400">
                    {notification.actorDisplayName ||
                      notification.actorUsername}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {notification.isRead ? null : (
                  <span className="size-2 rounded-full bg-pink-500" />
                )}
                <span className="text-gray-500 text-xs dark:text-gray-400">
                  {formatRelativeOrAbsolute(notification.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
};

export default memo(List);
