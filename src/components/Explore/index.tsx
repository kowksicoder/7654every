import { useState } from "react";
import Footer from "@/components/Shared/Footer";
import PageLayout from "@/components/Shared/PageLayout";
import ContentFeedType from "@/components/Shared/Post/ContentFeedType";
import Search from "@/components/Shared/Search";
import WhoToFollow from "@/components/Shared/Sidebar/WhoToFollow";
import type { MainContentFocus } from "@/indexer/generated";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import ExploreFeed from "./ExploreFeed";

const Explore = () => {
  const { currentAccount } = useAccountStore();
  const [focus, setFocus] = useState<MainContentFocus>();

  return (
    <PageLayout
      hideSearch
      sidebar={
        <>
          {currentAccount ? <WhoToFollow /> : null}
          <Footer />
        </>
      }
      title="Explore"
    >
      <div className="mx-5 mb-5 hidden md:mx-0 md:block">
        <div className="max-w-sm">
          <Search />
        </div>
      </div>
      <ContentFeedType
        focus={focus}
        layoutId="explore_tab"
        setFocus={setFocus}
      />
      <ExploreFeed focus={focus} />
    </PageLayout>
  );
};

export default Explore;
