import { BoltIcon } from "@heroicons/react/24/solid";
import FeaturePlaceholderPage from "@/components/Shared/FeaturePlaceholderPage";

const Streaks = () => {
  return (
    <FeaturePlaceholderPage
      accentClassName="bg-gradient-to-r from-emerald-400 via-lime-500 to-amber-400"
      bullets={[
        "This page can track daily activity streaks, milestones, and streak-based rewards.",
        "We can later add calendars, streak counters, freeze mechanics, and reset rules.",
        "Right now it gives the navigation a stable shell we can build into when the logic is ready."
      ]}
      description="A future streak tracker for daily activity and retention rewards."
      eyebrow="Momentum"
      icon={<BoltIcon className="size-6" />}
      statusPills={["Route live", "Tracking later", "Rewards later"]}
      title="Streaks"
    />
  );
};

export default Streaks;
