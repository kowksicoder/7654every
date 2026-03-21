import { Localstorage } from "@/data/storage";
import { createPersistedTrackedStore } from "@/store/createTrackedStore";
import type { Every1Profile } from "@/types/every1";

interface State {
  lastToastNotificationId: null | string;
  pendingReferralCode: null | string;
  profile: Every1Profile | null;
  setLastToastNotificationId: (notificationId: null | string) => void;
  setPendingReferralCode: (code: null | string) => void;
  setProfile: (profile: Every1Profile | null) => void;
}

const { useStore: useEvery1Store } = createPersistedTrackedStore<State>(
  (set) => ({
    lastToastNotificationId: null,
    pendingReferralCode: null,
    profile: null,
    setLastToastNotificationId: (notificationId) =>
      set(() => ({ lastToastNotificationId: notificationId })),
    setPendingReferralCode: (code) =>
      set(() => ({ pendingReferralCode: code })),
    setProfile: (profile) => set(() => ({ profile }))
  }),
  { name: Localstorage.Every1Store }
);

export { useEvery1Store };
