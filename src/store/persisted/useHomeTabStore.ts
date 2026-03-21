import { HomeFeedType, HomeFeedView } from "@/data/enums";
import { Localstorage } from "@/data/storage";
import { createPersistedTrackedStore } from "@/store/createTrackedStore";

interface State {
  feedType: HomeFeedType;
  viewMode: HomeFeedView;
  setFeedType: (feedType: HomeFeedType) => void;
  toggleViewMode: () => void;
}

const { useStore: useHomeTabStore } = createPersistedTrackedStore<State>(
  (set) => ({
    feedType: HomeFeedType.FOLLOWING,
    setFeedType: (feedType) => set(() => ({ feedType })),
    toggleViewMode: () =>
      set((state) => ({
        viewMode:
          state.viewMode === HomeFeedView.GRID
            ? HomeFeedView.LIST
            : HomeFeedView.GRID
      })),
    viewMode: HomeFeedView.GRID
  }),
  { name: Localstorage.HomeTabStore }
);

export { useHomeTabStore };
