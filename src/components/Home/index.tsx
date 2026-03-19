import PageLayout from "@/components/Shared/PageLayout";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import FeedType from "./FeedType";
import Hero from "./Hero";
import ZoraFeed from "./ZoraFeed";

const Home = () => {
  const { currentAccount } = useAccountStore();
  const loggedInWithAccount = Boolean(currentAccount);

  return (
    <PageLayout title="Explore">
      {!loggedInWithAccount ? <Hero /> : null}
      <FeedType />
      <ZoraFeed />
    </PageLayout>
  );
};

export default Home;
