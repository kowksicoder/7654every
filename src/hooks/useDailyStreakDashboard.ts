import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_DAILY_STREAK_DASHBOARD_QUERY_KEY,
  getDailyStreakDashboard
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

const useDailyStreakDashboard = () => {
  const { profile } = useEvery1Store();

  return useQuery({
    enabled: Boolean(profile?.id) && hasSupabaseConfig(),
    queryFn: () => getDailyStreakDashboard(profile?.id as string),
    queryKey: [EVERY1_DAILY_STREAK_DASHBOARD_QUERY_KEY, profile?.id],
    staleTime: 15000
  });
};

export default useDailyStreakDashboard;
