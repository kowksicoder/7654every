import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_REFERRAL_DASHBOARD_QUERY_KEY,
  getReferralDashboard
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

const useReferralDashboard = () => {
  const { profile } = useEvery1Store();

  return useQuery({
    enabled: Boolean(profile?.id) && hasSupabaseConfig(),
    queryFn: () => getReferralDashboard(profile?.id as string),
    queryKey: [EVERY1_REFERRAL_DASHBOARD_QUERY_KEY, profile?.id],
    staleTime: 15000
  });
};

export default useReferralDashboard;
