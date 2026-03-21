import { QueueListIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { Tabs } from "@/components/Shared/UI";
import { type HomeFeedType, HomeFeedView } from "@/data/enums";
import { useHomeTabStore } from "@/store/persisted/useHomeTabStore";
import { zoraHomeFeedConfig } from "./zoraHomeFeedConfig";

const FeedType = () => {
  const { feedType, setFeedType, toggleViewMode, viewMode } = useHomeTabStore();

  const tabs = Object.entries(zoraHomeFeedConfig).map(([type, config]) => ({
    name: config.label,
    type
  }));

  const ToggleIcon =
    viewMode === HomeFeedView.GRID ? QueueListIcon : Squares2X2Icon;
  const toggleLabel =
    viewMode === HomeFeedView.GRID
      ? "Switch to list view"
      : "Switch to grid view";

  return (
    <div className="mx-4 mb-4 flex items-center gap-2 md:mx-0 md:mb-5 md:gap-3">
      <Tabs
        active={feedType}
        className="min-w-0 flex-1 gap-1.5 md:gap-3"
        itemClassName="rounded-md px-2.5 py-1 text-[12px] md:rounded-lg md:px-3 md:py-1.5 md:text-sm"
        layoutId="home_tab"
        mobileScrollable
        setActive={(type) => {
          const nextType = type as HomeFeedType;
          setFeedType(nextType);
        }}
        tabs={tabs}
      />
      <button
        aria-label={toggleLabel}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950 md:size-10 md:rounded-xl dark:border-gray-800 dark:bg-black dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-50"
        onClick={toggleViewMode}
        title={toggleLabel}
        type="button"
      >
        <ToggleIcon className="size-4.5" />
      </button>
    </div>
  );
};

export default FeedType;
