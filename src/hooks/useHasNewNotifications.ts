import { hasSupabaseConfig } from "@/helpers/supabase";
import {
  NotificationOrderBy,
  useNotificationIndicatorQuery
} from "@/indexer/generated";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import { useNotificationStore } from "@/store/persisted/useNotificationStore";
import useEvery1UnreadCount from "./useEvery1UnreadCount";

const useHasNewNotifications = () => {
  const { currentAccount } = useAccountStore();
  const { profile } = useEvery1Store();
  const { lastSeenNotificationId } = useNotificationStore();
  const unreadEvery1Notifications = useEvery1UnreadCount();
  const shouldUseEvery1Notifications =
    hasSupabaseConfig() && Boolean(profile?.id);

  const { data } = useNotificationIndicatorQuery({
    skip: !currentAccount || shouldUseEvery1Notifications,
    variables: { request: { orderBy: NotificationOrderBy.Default } }
  });

  if (shouldUseEvery1Notifications) {
    return unreadEvery1Notifications > 0;
  }

  const latestNotificationWithId = data?.notifications?.items?.find(
    (notification) => "id" in notification
  );
  const latestId = latestNotificationWithId?.id;

  if (!latestId || !currentAccount) {
    return false;
  }

  return latestId !== lastSeenNotificationId;
};

export default useHasNewNotifications;
