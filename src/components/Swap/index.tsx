import { ArrowsRightLeftIcon } from "@heroicons/react/24/solid";
import FeaturePlaceholderPage from "@/components/Shared/FeaturePlaceholderPage";

const Swap = () => {
  return (
    <FeaturePlaceholderPage
      accentClassName="bg-gradient-to-r from-sky-400 via-cyan-500 to-blue-600"
      bullets={[
        "This can become the token swap flow with wallet connection, token selectors, and route previews.",
        "We can design slippage, price impact, and confirmation states when we decide on the swap provider.",
        "For now it gives the sidebar a real destination instead of a dead menu item."
      ]}
      description="A future swap surface for token routing and wallet actions."
      eyebrow="Trading"
      icon={<ArrowsRightLeftIcon className="size-6" />}
      statusPills={["Route live", "Wallet flow later", "Execution later"]}
      title="Swap"
    />
  );
};

export default Swap;
