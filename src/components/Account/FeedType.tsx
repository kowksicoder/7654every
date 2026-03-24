import type { Dispatch, SetStateAction } from "react";
import { Tabs } from "@/components/Shared/UI";
import { AccountFeedType } from "@/data/enums";
import generateUUID from "@/helpers//generateUUID";

interface FeedTypeProps {
  feedType: AccountFeedType;
  showFanDrops?: boolean;
  setFeedType: Dispatch<SetStateAction<AccountFeedType>>;
}

const FeedType = ({
  feedType,
  setFeedType,
  showFanDrops = false
}: FeedTypeProps) => {
  const tabs = [
    { name: "Feed", type: AccountFeedType.Feed },
    { name: "Replies", type: AccountFeedType.Replies },
    { name: "Media", type: AccountFeedType.Media },
    { name: "Collected", type: AccountFeedType.Collects },
    ...(showFanDrops
      ? [{ name: "FanDrops", type: AccountFeedType.FanDrops }]
      : [])
  ];

  return (
    <Tabs
      active={feedType}
      className="mx-5 mb-5 md:mx-0"
      key={generateUUID()}
      layoutId="account_tab"
      setActive={(type) => {
        const nextType = type as AccountFeedType;
        setFeedType(nextType);
      }}
      tabs={tabs}
    />
  );
};

export default FeedType;
