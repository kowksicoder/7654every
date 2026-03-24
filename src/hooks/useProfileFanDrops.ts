import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_FANDROPS_QUERY_KEY,
  getProfileFanDrops
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

interface UseProfileFanDropsOptions {
  creatorProfileId?: null | string;
  slug?: null | string;
}

const useProfileFanDrops = ({
  creatorProfileId,
  slug
}: UseProfileFanDropsOptions = {}) => {
  const { profile } = useEvery1Store();

  return useQuery({
    enabled: hasSupabaseConfig(),
    queryFn: async () => {
      const campaigns = await getProfileFanDrops({
        profileId: profile?.id || null,
        slug: slug || null
      });

      if (!creatorProfileId) {
        return campaigns;
      }

      return campaigns.filter(
        (campaign) => campaign.creatorProfileId === creatorProfileId
      );
    },
    queryKey: [
      EVERY1_FANDROPS_QUERY_KEY,
      profile?.id || null,
      slug || null,
      creatorProfileId || null
    ],
    staleTime: 15000
  });
};

export default useProfileFanDrops;
