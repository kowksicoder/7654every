import type { Dispatch, SetStateAction } from "react";
import { Tabs } from "@/components/Shared/UI";
import { AccountFeedType } from "@/data/enums";
import generateUUID from "@/helpers//generateUUID";

interface FeedTypeProps {
  showCollaborations?: boolean;
  feedType: AccountFeedType;
  showFanDrops?: boolean;
  setFeedType: Dispatch<SetStateAction<AccountFeedType>>;
}

const FeedType = ({
  feedType,
  setFeedType,
  showCollaborations = false,
  showFanDrops = false
}: FeedTypeProps) => {
  const tabs = [
    { name: "Feed", type: AccountFeedType.Feed },
    { name: "Media", type: AccountFeedType.Media },
    { name: "Holdings", type: AccountFeedType.Collects },
    ...(showCollaborations
      ? [{ name: "Collaborations", type: AccountFeedType.Collaborations }]
      : []),
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
