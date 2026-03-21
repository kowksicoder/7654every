import { Link, useLocation } from "react-router";
import cn from "@/helpers/cn";

interface RewardsPageTabsProps {
  className?: string;
}

const RewardsPageTabs = ({ className }: RewardsPageTabsProps) => {
  const { pathname } = useLocation();

  const activeTab = pathname.startsWith("/streaks") ? "streaks" : "referrals";
  const isReferralPage =
    pathname === "/referrals" || pathname.startsWith("/referrals/");

  if (isReferralPage) {
    return (
      <div
        className={cn(
          "inline-flex w-fit items-center gap-0.5 rounded-full bg-gray-100 p-0.5 dark:bg-gray-900",
          className
        )}
      >
        <Link
          className="rounded-full px-2 py-1 font-semibold text-[11px] text-gray-600 leading-none transition-colors hover:text-gray-900 md:px-3 md:text-xs dark:text-gray-300 dark:hover:text-gray-50"
          to="/streaks"
        >
          Streaks
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex w-fit items-center gap-0.5 rounded-full bg-gray-100 p-0.5 dark:bg-gray-900",
        className
      )}
    >
      <Link
        aria-current={activeTab === "referrals" ? "page" : undefined}
        className={cn(
          "rounded-full px-2 py-1 font-semibold text-[11px] leading-none transition-colors md:px-3 md:text-xs",
          activeTab === "referrals"
            ? "bg-white text-gray-950 shadow-sm dark:bg-black dark:text-gray-50"
            : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50"
        )}
        to="/referrals"
      >
        Referrals
      </Link>
      <Link
        aria-current={activeTab === "streaks" ? "page" : undefined}
        className={cn(
          "rounded-full px-2 py-1 font-semibold text-[11px] leading-none transition-colors md:px-3 md:text-xs",
          activeTab === "streaks"
            ? "bg-white text-gray-950 shadow-sm dark:bg-black dark:text-gray-50"
            : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50"
        )}
        to="/streaks"
      >
        Streaks
      </Link>
    </div>
  );
};

export default RewardsPageTabs;
