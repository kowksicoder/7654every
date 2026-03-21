import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_NOTIFICATIONS_QUERY_KEY,
  listProfileNotifications
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

interface UseEvery1NotificationsOptions {
  kind?: null | string;
  limit?: number;
  refetchInterval?: false | number;
  scope?: string;
}

const useEvery1Notifications = ({
  kind,
  limit = 50,
  refetchInterval = false,
  scope = "default"
}: UseEvery1NotificationsOptions = {}) => {
  const { profile } = useEvery1Store();

  return useQuery({
    enabled: Boolean(profile?.id) && hasSupabaseConfig(),
    queryFn: () =>
      listProfileNotifications(profile?.id as string, {
        kind,
        limit
      }),
    queryKey: [EVERY1_NOTIFICATIONS_QUERY_KEY, profile?.id, scope, kind, limit],
    refetchInterval
  });
};

export default useEvery1Notifications;
