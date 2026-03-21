import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_NOTIFICATION_COUNT_QUERY_KEY,
  getUnreadNotificationCount
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

const useEvery1UnreadCount = () => {
  const { profile } = useEvery1Store();

  const query = useQuery({
    enabled: Boolean(profile?.id) && hasSupabaseConfig(),
    queryFn: () => getUnreadNotificationCount(profile?.id as string),
    queryKey: [EVERY1_NOTIFICATION_COUNT_QUERY_KEY, profile?.id],
    refetchInterval: 15000
  });

  return query.data ?? 0;
};

export default useEvery1UnreadCount;
