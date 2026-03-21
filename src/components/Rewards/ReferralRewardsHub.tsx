import {
  ArrowTrendingUpIcon,
  GiftIcon,
  SparklesIcon,
  UserPlusIcon
} from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import Loader from "@/components/Shared/Loader";
import {
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  StackedAvatars,
  Tabs
} from "@/components/Shared/UI";
import formatRelativeOrAbsolute from "@/helpers/datetime/formatRelativeOrAbsolute";
import { buildReferralLink } from "@/helpers/every1";
import nFormatter from "@/helpers/nFormatter";
import useCopyToClipboard from "@/hooks/useCopyToClipboard";
import useReferralDashboard from "@/hooks/useReferralDashboard";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import RewardsPageTabs from "./RewardsPageTabs";

type ShareView = "code" | "link";
type ReferralActivityItem = {
  id: string;
  createdAt: string;
  subtitle?: string;
  title: string;
  tone: "emerald" | "fuchsia";
  value: string;
};

const ReferralRewardsHub = () => {
  const { profile } = useEvery1Store();
  const { data, error, isLoading } = useReferralDashboard();
  const [shareView, setShareView] = useState<ShareView>("link");

  const referralCode = data?.referralCode || profile?.referralCode || "";
  const referralLink = buildReferralLink(referralCode);
  const recentAvatarPool = useMemo(
    () =>
      [
        ...(data?.recentReferrals || []).map((entry) => entry.avatarUrl),
        ...(data?.recentTradeRewards || []).map((entry) => entry.avatarUrl)
      ].filter(Boolean) as string[],
    [data?.recentReferrals, data?.recentTradeRewards]
  );
  const recentActivity = useMemo<ReferralActivityItem[]>(
    () =>
      [
        ...((data?.recentTradeRewards || []).map((reward) => ({
          createdAt: reward.createdAt,
          id: `trade-${reward.id}`,
          title: `${reward.displayName || reward.username || "Referral"} ${reward.tradeSide === "buy" ? "bought" : "sold"} ${reward.coinSymbol}`,
          tone: "emerald" as const,
          value: `+${nFormatter(reward.rewardAmount, 4)} ${reward.coinSymbol}`
        })) satisfies ReferralActivityItem[]),
        ...((data?.recentE1xp || [])
          .filter((entry) => entry.source === "referral")
          .map((entry) => ({
            createdAt: entry.createdAt,
            id: `xp-${entry.id}`,
            title: entry.description || "Referral E1XP reward",
            tone: "fuchsia" as const,
            value: `${entry.amount > 0 ? "+" : ""}${nFormatter(entry.amount, 1)} E1XP`
          })) satisfies ReferralActivityItem[])
      ]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 8),
    [data?.recentE1xp, data?.recentTradeRewards]
  );

  const copyReferralLink = useCopyToClipboard(
    referralLink,
    "Referral link copied",
    "Couldn't copy your referral link"
  );
  const copyReferralCode = useCopyToClipboard(
    referralCode,
    "Referral code copied",
    "Couldn't copy your referral code"
  );

  const handleShare = async () => {
    if (shareView === "code") {
      await copyReferralCode();
      return;
    }

    if (navigator.share && referralLink) {
      try {
        await navigator.share({
          text: "Join Every1 with my referral link and unlock creator rewards.",
          title: "Join Every1",
          url: referralLink
        });
        return;
      } catch {}
    }

    await copyReferralLink();
  };

  if (!profile?.id) {
    return (
      <Card className="mx-5 p-6 md:mx-0" forceRounded>
        <div className="flex min-h-40 items-center justify-center">
          <Loader />
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="mx-5 p-6 md:mx-0" forceRounded>
        <div className="flex min-h-40 items-center justify-center">
          <Loader />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <ErrorMessage
        className="mx-5 md:mx-0"
        error={error}
        title="Failed to load rewards"
      />
    );
  }

  const dashboard = data;

  return (
    <div className="space-y-5">
      <Card className="mx-5 overflow-hidden p-3.5 md:mx-0 md:p-6" forceRounded>
        <div className="space-y-3 md:space-y-4">
          <div className="flex items-start justify-between gap-2.5 sm:gap-4">
            <div className="min-w-0 flex-1 space-y-1.5 md:space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold text-[9px] text-emerald-700 md:px-3 md:py-1 md:text-xs dark:bg-emerald-500/10 dark:text-emerald-300">
                  {dashboard?.bonusPercent || 10}% coin bonus
                </span>
                <span className="rounded-full bg-fuchsia-100 px-1.5 py-0.5 font-semibold text-[9px] text-fuchsia-700 md:px-3 md:py-1 md:text-[11px] dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
                  <span className="sm:hidden">+50 join • trade</span>
                  <span className="hidden sm:inline">
                    +50 on join, +50 on first trade
                  </span>
                </span>
                <RewardsPageTabs className="ml-auto" />
              </div>
              <h2 className="font-semibold text-gray-950 text-lg leading-tight md:text-2xl dark:text-gray-50">
                Invite friends, earn rewards
              </h2>
              <p className="max-w-xl text-gray-600 text-xs leading-4 md:text-sm md:leading-5 dark:text-gray-400">
                <span className="sm:hidden">Share your link or code.</span>
                <span className="hidden sm:inline">
                  Share your link or code to start earning.
                </span>
              </p>
            </div>
            <div className="shrink-0 self-start">
              <div className="rounded-full bg-emerald-100 p-1 dark:bg-emerald-500/10">
                {recentAvatarPool.length > 0 || profile.avatarUrl ? (
                  <StackedAvatars
                    avatars={
                      recentAvatarPool.length > 0
                        ? recentAvatarPool
                        : profile.avatarUrl
                          ? [profile.avatarUrl]
                          : []
                    }
                    limit={3}
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-white text-emerald-700 md:size-9 dark:bg-gray-950 dark:text-emerald-300">
                    <GiftIcon className="size-4 md:size-4.5" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3.5 md:space-y-3">
            <Tabs
              active={shareView}
              className="rounded-xl bg-gray-100 p-0.5 md:rounded-2xl md:p-1 dark:bg-gray-900"
              itemClassName="flex-1 justify-center rounded-lg py-1.5 text-xs font-semibold text-gray-700 md:rounded-xl md:py-2 md:text-sm dark:text-gray-200"
              layoutId="referral_share_view"
              mobileScrollable={false}
              setActive={(type) => setShareView(type as ShareView)}
              tabs={[
                { name: "Invite link", type: "link" },
                { name: "Code", type: "code" }
              ]}
            />

            <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 p-2.5 md:gap-3 md:rounded-2xl md:p-3 dark:bg-gray-900">
              <div className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 font-semibold text-gray-950 text-sm md:rounded-2xl md:px-4 md:py-3 md:text-lg dark:bg-black dark:text-gray-50">
                <div className="truncate">
                  {shareView === "link" ? referralLink : referralCode}
                </div>
              </div>
              <Button
                className="shrink-0 whitespace-nowrap"
                onClick={handleShare}
                size="sm"
              >
                {shareView === "link" ? "Share link" : "Share code"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 md:gap-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-center md:rounded-2xl md:p-4 md:text-left dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-1 flex items-center justify-center gap-1 text-gray-500 md:mb-1.5 md:justify-start md:gap-2 dark:text-gray-400">
                <UserPlusIcon className="size-3.5 md:size-4" />
                <span className="text-[9px] uppercase tracking-[0.14em] md:text-xs md:tracking-[0.18em]">
                  Referrals
                </span>
              </div>
              <p className="font-semibold text-[1.15rem] text-gray-950 leading-none md:text-2xl dark:text-gray-50">
                {dashboard?.stats.joinedCount || 0}
              </p>
              <p className="mt-1 hidden text-[11px] text-gray-500 leading-4 md:block md:text-sm md:leading-5 dark:text-gray-400">
                Joined with your invite
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-center md:rounded-2xl md:p-4 md:text-left dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-1 flex items-center justify-center gap-1 text-gray-500 md:mb-1.5 md:justify-start md:gap-2 dark:text-gray-400">
                <ArrowTrendingUpIcon className="size-3.5 md:size-4" />
                <span className="text-[9px] uppercase tracking-[0.14em] md:text-xs md:tracking-[0.18em]">
                  Coin Bonus
                </span>
              </div>
              <p className="font-semibold text-[1.15rem] text-gray-950 leading-none md:text-2xl dark:text-gray-50">
                {nFormatter(dashboard?.stats.totalCoinRewards || 0, 2)}
              </p>
              <p className="mt-1 hidden text-[11px] text-gray-500 leading-4 md:block md:text-sm md:leading-5 dark:text-gray-400">
                Total creator coin rewards
              </p>
              <p className="mt-2 hidden font-medium text-[11px] text-gray-400 uppercase leading-4 tracking-[0.16em] md:block dark:text-gray-500">
                {dashboard?.stats.rewardedCount || 0} unlocked rewards
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-center md:rounded-2xl md:p-4 md:text-left dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-1 flex items-center justify-center gap-1 text-gray-500 md:mb-1.5 md:justify-start md:gap-2 dark:text-gray-400">
                <SparklesIcon className="size-3.5 md:size-4" />
                <span className="text-[9px] uppercase tracking-[0.14em] md:text-xs md:tracking-[0.18em]">
                  E1XP
                </span>
              </div>
              <p className="font-semibold text-[1.15rem] text-gray-950 leading-none md:text-2xl dark:text-gray-50">
                {nFormatter(dashboard?.stats.totalE1xp || 0, 1)}
              </p>
              <p className="mt-1 hidden text-[11px] text-gray-500 leading-4 md:block md:text-sm md:leading-5 dark:text-gray-400">
                Referral points earned
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mx-5 p-5 md:mx-0 md:p-6" forceRounded>
        <div className="mb-4">
          <h3 className="font-semibold text-base text-gray-950 md:text-lg dark:text-gray-50">
            Activity
          </h3>
        </div>

        {recentActivity.length ? (
          <div className="space-y-2.5">
            {recentActivity.map((entry) => (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-800"
                key={entry.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                    {entry.title}
                  </p>
                  {entry.subtitle ? (
                    <p className="text-gray-500 text-xs dark:text-gray-400">
                      {entry.subtitle}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`font-semibold text-sm ${
                      entry.tone === "emerald"
                        ? "text-emerald-600 dark:text-emerald-300"
                        : "text-fuchsia-600 dark:text-fuchsia-300"
                    }`}
                  >
                    {entry.value}
                  </p>
                  <p className="text-gray-500 text-xs dark:text-gray-400">
                    {formatRelativeOrAbsolute(entry.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            hideCard
            icon={<GiftIcon className="size-8" />}
            message="Your referral rewards and E1XP activity will show up here."
          />
        )}
      </Card>
    </div>
  );
};

export default ReferralRewardsHub;
