import ReferralRewardsHub from "@/components/Rewards/ReferralRewardsHub";
import BackButton from "@/components/Shared/BackButton";
import NotLoggedIn from "@/components/Shared/NotLoggedIn";
import PageLayout from "@/components/Shared/PageLayout";
import { Card, CardHeader } from "@/components/Shared/UI";
import { useAccountStore } from "@/store/persisted/useAccountStore";

const RewardsSettings = () => {
  const { currentAccount } = useAccountStore();

  if (!currentAccount) {
    return <NotLoggedIn />;
  }

  return (
    <PageLayout title="Rewards">
      <Card>
        <CardHeader
          body="Referral bonuses and E1XP rewards are tracked here in real time."
          icon={<BackButton path="/settings" />}
          title="Rewards"
        />
      </Card>
      <ReferralRewardsHub />
    </PageLayout>
  );
};

export default RewardsSettings;
