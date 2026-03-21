import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_MISSIONS_QUERY_KEY,
  getProfileMissions
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

interface UseProfileMissionsOptions {
  scope?: string;
  taskType?: null | string;
}

const useProfileMissions = ({
  scope = "default",
  taskType
}: UseProfileMissionsOptions = {}) => {
  const { profile } = useEvery1Store();

  return useQuery({
    enabled: Boolean(profile?.id) && hasSupabaseConfig(),
    queryFn: () => getProfileMissions(profile?.id as string, taskType),
    queryKey: [EVERY1_MISSIONS_QUERY_KEY, profile?.id, scope, taskType || null],
    staleTime: 15000
  });
};

export default useProfileMissions;
