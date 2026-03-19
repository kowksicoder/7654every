import { TrophyIcon } from "@heroicons/react/24/solid";
import FeaturePlaceholderPage from "@/components/Shared/FeaturePlaceholderPage";

const Leaderboard = () => {
  return (
    <FeaturePlaceholderPage
      accentClassName="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500"
      bullets={[
        "Global rankings for creators, collectors, and communities can live here.",
        "We can add time filters, category tabs, and score breakdowns once the data source is chosen.",
        "This page is a ready placeholder so the sidebar structure is in place now."
      ]}
      description="A future ranking surface for creators, communities, and campaigns."
      eyebrow="Rankings"
      icon={<TrophyIcon className="size-6" />}
      statusPills={["Menu live", "Placeholder ready", "Data later"]}
      title="Leaderboard"
    />
  );
};

export default Leaderboard;
