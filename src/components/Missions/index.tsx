import { FlagIcon } from "@heroicons/react/24/solid";
import FeaturePlaceholderPage from "@/components/Shared/FeaturePlaceholderPage";

const Missions = () => {
  return (
    <FeaturePlaceholderPage
      accentClassName="bg-gradient-to-r from-violet-400 via-fuchsia-500 to-rose-500"
      bullets={[
        "This is a good home for quests, campaigns, and action-based reward programs.",
        "We can later add progress cards, claim flows, and completion logic tied to protocol activity.",
        "The page is intentionally light for now so we can shape it around the real missions model."
      ]}
      description="A future mission hub for quests, tasks, and campaign rewards."
      eyebrow="Campaigns"
      icon={<FlagIcon className="size-6" />}
      statusPills={["Route live", "Quest UX later", "Rewards later"]}
      title="Missions"
    />
  );
};

export default Missions;
