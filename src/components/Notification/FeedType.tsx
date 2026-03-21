import type { Dispatch, SetStateAction } from "react";
import { Tabs } from "@/components/Shared/UI";
import { NotificationFeedType } from "@/data/enums";

interface FeedTypeProps {
  feedType: NotificationFeedType;
  setFeedType: Dispatch<SetStateAction<NotificationFeedType>>;
}

const FeedType = ({ feedType, setFeedType }: FeedTypeProps) => {
  const tabs = [
    { name: "All", type: NotificationFeedType.All },
    { name: "Activity", type: NotificationFeedType.Activity },
    { name: "Referrals", type: NotificationFeedType.Referrals },
    { name: "Rewards", type: NotificationFeedType.Rewards },
    { name: "System", type: NotificationFeedType.System }
  ];

  return (
    <Tabs
      active={feedType}
      className="mx-5 mb-5 md:mx-0"
      layoutId="notification_tab"
      mobileScrollable
      setActive={(type) => {
        const nextType = type as NotificationFeedType;
        setFeedType(nextType);
      }}
      tabs={tabs}
    />
  );
};

export default FeedType;
