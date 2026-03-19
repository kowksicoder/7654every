import { Tabs } from "@/components/Shared/UI";
import { HomeFeedType } from "@/data/enums";
import { useHomeTabStore } from "@/store/persisted/useHomeTabStore";
import { zoraHomeFeedConfig } from "./zoraHomeFeedConfig";

const FeedType = () => {
  const { feedType, setFeedType } = useHomeTabStore();

  const tabs = Object.entries(zoraHomeFeedConfig).map(([type, config]) => ({
    name: config.label,
    type
  }));

  return (
    <Tabs
      active={feedType}
      className="mx-5 mb-5 md:mx-0"
      layoutId="home_tab"
      setActive={(type) => {
        const nextType = type as HomeFeedType;
        setFeedType(nextType);
      }}
      tabs={tabs}
    />
  );
};

export default FeedType;
