import ReferralRewardsHub from "@/components/Rewards/ReferralRewardsHub";
import NotLoggedIn from "@/components/Shared/NotLoggedIn";
import PageLayout from "@/components/Shared/PageLayout";
import { useAccountStore } from "@/store/persisted/useAccountStore";

const Referrals = () => {
  const { currentAccount } = useAccountStore();

  if (!currentAccount) {
    return <NotLoggedIn />;
  }

  return (
    <PageLayout
      description="Share your invite link, earn 50 E1XP when someone joins, then unlock coin bonus plus 50 more E1XP on their first trade."
      title="Referrals"
    >
      <ReferralRewardsHub />
    </PageLayout>
  );
};

export default Referrals;
