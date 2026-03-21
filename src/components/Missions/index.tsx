import ReferralRewardsHub from "@/components/Rewards/ReferralRewardsHub";
import NotLoggedIn from "@/components/Shared/NotLoggedIn";
import PageLayout from "@/components/Shared/PageLayout";
import { useAccountStore } from "@/store/persisted/useAccountStore";

const Missions = () => {
  const { currentAccount } = useAccountStore();

  if (!currentAccount) {
    return <NotLoggedIn />;
  }

  return (
    <PageLayout
      description="Invite creators, unlock referral bonuses, and build up your E1XP rewards."
      title="Invite & Earn"
    >
      <ReferralRewardsHub />
    </PageLayout>
  );
};

export default Missions;
