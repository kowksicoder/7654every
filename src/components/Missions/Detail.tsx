import {
  ArrowLeftIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ClockIcon,
  FireIcon,
  GiftTopIcon,
  UserGroupIcon
} from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { toast } from "sonner";
import PageLayout from "@/components/Shared/PageLayout";
import { Card } from "@/components/Shared/UI";
import cn from "@/helpers/cn";
import {
  EVERY1_FANDROPS_QUERY_KEY,
  EVERY1_NOTIFICATION_COUNT_QUERY_KEY,
  EVERY1_NOTIFICATIONS_QUERY_KEY,
  joinFanDropCampaign
} from "@/helpers/every1";
import useProfileFanDrops from "@/hooks/useProfileFanDrops";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import {
  type FanDropCampaign,
  getStaticFanDropFallbackBySlug,
  mapEvery1FanDropToCard
} from "./data";

const stateBadgeStyles: Record<FanDropCampaign["state"], string> = {
  completed:
    "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300",
  ended: "bg-gray-950/8 text-gray-700 dark:bg-white/10 dark:text-gray-300",
  joined: "bg-sky-500/12 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300",
  live: "bg-orange-500/12 text-orange-700 dark:bg-orange-500/12 dark:text-orange-300"
};

const stateLabels: Record<FanDropCampaign["state"], string> = {
  completed: "Completed",
  ended: "Ended",
  joined: "Joined",
  live: "Live"
};

const renderTaskIcon = (
  taskState: FanDropCampaign["tasks"][number]["state"]
) => {
  if (taskState === "complete") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
        <CheckCircleIcon className="size-4" />
      </span>
    );
  }

  if (taskState === "optional") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full border border-gray-300 font-bold text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
        O
      </span>
    );
  }

  return (
    <span className="flex size-5 items-center justify-center rounded-full border border-gray-300 font-bold text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
      -
    </span>
  );
};

const FanDropDetail = () => {
  const queryClient = useQueryClient();
  const { profile, setLastToastNotificationId } = useEvery1Store();
  const { slug } = useParams();
  const [isJoining, setIsJoining] = useState(false);
  const fanDropQuery = useProfileFanDrops({ slug });
  const displayCampaign = useMemo(
    () =>
      fanDropQuery.data?.[0]
        ? mapEvery1FanDropToCard(fanDropQuery.data[0])
        : getStaticFanDropFallbackBySlug(slug),
    [fanDropQuery.data, slug]
  );

  if (!displayCampaign) {
    return <Navigate replace to="/fandrop" />;
  }

  const progressPercent =
    displayCampaign.progressTotal > 0
      ? (displayCampaign.progressComplete / displayCampaign.progressTotal) * 100
      : 0;

  const handleJoinCampaign = async () => {
    if (displayCampaign.state !== "live") {
      return;
    }

    if (!profile?.id) {
      toast.error("Sign in to join this FanDrop.");
      return;
    }

    if (isJoining) {
      return;
    }

    setIsJoining(true);

    try {
      const result = await joinFanDropCampaign(profile.id, {
        creatorName: displayCampaign.creatorName,
        rewardPoolLabel: displayCampaign.rewardPoolLabel,
        slug: displayCampaign.slug,
        state: displayCampaign.state,
        title: displayCampaign.title
      });

      if (result.notificationId) {
        setLastToastNotificationId(result.notificationId);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [EVERY1_FANDROPS_QUERY_KEY, profile.id || null]
        }),
        queryClient.invalidateQueries({
          queryKey: [EVERY1_NOTIFICATIONS_QUERY_KEY, profile.id]
        }),
        queryClient.invalidateQueries({
          queryKey: [EVERY1_NOTIFICATION_COUNT_QUERY_KEY, profile.id]
        })
      ]);

      toast.success(
        result.alreadyJoined
          ? `Already in ${displayCampaign.title}`
          : `Joined ${displayCampaign.title}`,
        {
          description: result.alreadyJoined
            ? "Finish the remaining actions before the reward pool closes."
            : `${displayCampaign.rewardPoolLabel} is live now.`
        }
      );
    } catch (error) {
      console.error("Failed to join FanDrop", error);
      toast.error("Couldn't join this FanDrop.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <PageLayout
      description={displayCampaign.subtitle}
      hideDesktopSidebar
      title={`${displayCampaign.title} | FanDrop`}
    >
      <div className="mx-4 space-y-2 md:mx-0 md:space-y-5">
        <Link
          className="hidden items-center gap-1.5 text-[13px] text-gray-600 transition-colors hover:text-gray-950 md:inline-flex md:gap-2 md:text-sm dark:text-gray-400 dark:hover:text-gray-100"
          to="/fandrop"
        >
          <ArrowLeftIcon className="size-4" />
          Back to FanDrop
        </Link>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.75fr)] xl:gap-5">
          <Card
            className="overflow-hidden border border-gray-200/70 bg-white dark:border-gray-800 dark:bg-black"
            forceRounded
          >
            <div
              className={cn("p-2.5 md:p-7", displayCampaign.accentClassName)}
            >
              <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[10px] md:px-3 md:py-1.5 md:text-xs",
                    stateBadgeStyles[displayCampaign.state]
                  )}
                >
                  <FireIcon className="size-3 md:size-4" />
                  {stateLabels[displayCampaign.state]}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-0.5 font-semibold text-[10px] text-gray-700 backdrop-blur md:px-3 md:py-1.5 md:text-xs dark:bg-black/25 dark:text-gray-100">
                  <ClockIcon className="size-3 md:size-4" />
                  {displayCampaign.timeLabel}
                </span>
                <span className="inline-flex rounded-full bg-white/70 px-2 py-0.5 font-medium text-[10px] text-gray-700 backdrop-blur md:hidden dark:bg-black/20 dark:text-gray-100">
                  {displayCampaign.coverLabel}
                </span>
              </div>

              <div className="mt-2 max-w-2xl space-y-1 md:mt-8 md:space-y-3">
                <p className="hidden font-medium text-[10px] text-gray-700/70 uppercase tracking-[0.18em] md:block md:text-[11px] md:tracking-[0.22em] dark:text-gray-100/70">
                  {displayCampaign.coverLabel}
                </p>
                <h1 className="font-semibold text-gray-950 text-lg leading-tight md:text-5xl dark:text-gray-50">
                  {displayCampaign.title}
                </h1>
                <p className="text-[11px] text-gray-800/80 md:hidden dark:text-gray-100/80">
                  {displayCampaign.creatorName} /{" "}
                  {displayCampaign.creatorHandle}
                </p>
                <p className="max-w-xl text-[12px] text-gray-700/90 leading-4 md:text-base md:leading-7 dark:text-gray-100/85">
                  {displayCampaign.subtitle}
                </p>
              </div>

              {displayCampaign.state === "live" ? (
                <button
                  className="mt-2.5 inline-flex w-full items-center justify-center rounded-full bg-gray-950 px-3 py-2 font-semibold text-[13px] text-white transition-colors hover:bg-gray-800 md:hidden dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
                  onClick={() => void handleJoinCampaign()}
                  type="button"
                >
                  {isJoining ? "Joining..." : displayCampaign.ctaLabel}
                </button>
              ) : (
                <a
                  className="mt-2.5 inline-flex w-full items-center justify-center rounded-full bg-gray-950 px-3 py-2 font-semibold text-[13px] text-white transition-colors hover:bg-gray-800 md:hidden dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
                  href="#fandrop-tasks"
                >
                  {displayCampaign.ctaLabel}
                </a>
              )}

              <div className="mt-2 grid grid-cols-4 gap-1 md:mt-8 md:grid-cols-4 md:gap-3">
                <div className="rounded-2xl bg-white/75 px-2 py-1.5 backdrop-blur md:px-4 md:py-3 dark:bg-black/20">
                  <p className="text-[10px] text-gray-600 uppercase tracking-[0.14em] md:text-[11px] md:tracking-[0.18em] dark:text-gray-300">
                    Pool
                  </p>
                  <p className="mt-0.5 font-semibold text-[11px] text-gray-950 leading-3.5 md:mt-1 md:text-lg dark:text-gray-50">
                    {displayCampaign.rewardPoolLabel}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/75 px-2 py-1.5 backdrop-blur md:px-4 md:py-3 dark:bg-black/20">
                  <p className="text-[10px] text-gray-600 uppercase tracking-[0.14em] md:text-[11px] md:tracking-[0.18em] dark:text-gray-300">
                    Rank
                  </p>
                  <p className="mt-0.5 font-semibold text-[11px] text-gray-950 leading-3.5 md:mt-1 md:text-lg dark:text-gray-50">
                    {displayCampaign.rankLabel}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/75 px-2 py-1.5 backdrop-blur md:hidden dark:bg-black/20">
                  <p className="text-[10px] text-gray-600 uppercase tracking-[0.14em] dark:text-gray-300">
                    Creator
                  </p>
                  <p className="mt-0.5 truncate font-semibold text-[11px] text-gray-950 leading-3.5 dark:text-gray-50">
                    {displayCampaign.creatorName}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/75 px-2 py-1.5 backdrop-blur md:px-4 md:py-3 dark:bg-black/20">
                  <p className="text-[10px] text-gray-600 uppercase tracking-[0.14em] md:text-[11px] md:tracking-[0.18em] dark:text-gray-300">
                    Progress
                  </p>
                  <p className="mt-0.5 font-semibold text-[11px] text-gray-950 leading-3.5 md:mt-1 md:text-lg dark:text-gray-50">
                    {displayCampaign.progressComplete}/
                    {displayCampaign.progressTotal}
                  </p>
                </div>
                <div className="hidden rounded-2xl bg-white/75 px-4 py-3 backdrop-blur md:block dark:bg-black/20">
                  <p className="text-[11px] text-gray-600 uppercase tracking-[0.18em] dark:text-gray-300">
                    Creator
                  </p>
                  <p className="mt-1 truncate font-semibold text-gray-950 text-lg dark:text-gray-50">
                    {displayCampaign.creatorName}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <div className="hidden space-y-5 xl:block">
            <Card
              className="border border-gray-200/70 bg-white p-5 dark:border-gray-800 dark:bg-black"
              forceRounded
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-[0.2em] dark:text-gray-400">
                      Current standing
                    </p>
                    <p className="mt-1 font-semibold text-2xl text-gray-950 dark:text-gray-50">
                      {displayCampaign.rankLabel}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-semibold text-[11px] text-emerald-700 dark:text-emerald-300">
                    {displayCampaign.creatorHandle}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      Campaign progress
                    </span>
                    <span className="font-semibold text-gray-950 dark:text-gray-50">
                      {displayCampaign.progressComplete}/
                      {displayCampaign.progressTotal}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-900">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max(progressPercent, 8)}%` }}
                    />
                  </div>
                </div>

                {displayCampaign.state === "live" ? (
                  <button
                    className="inline-flex w-full items-center justify-center rounded-full bg-gray-950 px-4 py-3 font-semibold text-sm text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
                    onClick={() => void handleJoinCampaign()}
                    type="button"
                  >
                    {isJoining ? "Joining..." : displayCampaign.ctaLabel}
                  </button>
                ) : (
                  <a
                    className="inline-flex w-full items-center justify-center rounded-full bg-gray-950 px-4 py-3 font-semibold text-sm text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
                    href="#fandrop-tasks"
                  >
                    {displayCampaign.ctaLabel}
                  </a>
                )}
              </div>
            </Card>

            <Card
              className="border border-gray-200/70 bg-white p-5 dark:border-gray-800 dark:bg-black"
              forceRounded
            >
              <div className="space-y-3">
                <h2 className="font-semibold text-gray-950 text-lg dark:text-gray-50">
                  How this FanDrop works
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <GiftTopIcon className="mt-0.5 size-4.5 text-gray-500 dark:text-gray-400" />
                    <p className="text-gray-600 leading-6 dark:text-gray-400">
                      Complete the listed fan actions before the timer closes.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <UserGroupIcon className="mt-0.5 size-4.5 text-gray-500 dark:text-gray-400" />
                    <p className="text-gray-600 leading-6 dark:text-gray-400">
                      Invite your circle, push the campaign forward, and improve
                      your position.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <ArrowTrendingUpIcon className="mt-0.5 size-4.5 text-gray-500 dark:text-gray-400" />
                    <p className="text-gray-600 leading-6 dark:text-gray-400">
                      Higher progress and stronger momentum move you closer to
                      the reward pool.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] xl:gap-5">
          <Card
            className="border border-gray-200/70 bg-white p-3.5 md:p-5 dark:border-gray-800 dark:bg-black"
            forceRounded
          >
            <div className="space-y-3 md:space-y-5" id="fandrop-tasks">
              <div className="space-y-0.5 md:space-y-1">
                <p className="hidden text-gray-500 text-xs uppercase tracking-[0.2em] md:block dark:text-gray-400">
                  Action board
                </p>
                <h2 className="font-semibold text-gray-950 text-lg md:mt-2 md:text-2xl dark:text-gray-50">
                  FanDrop tasks
                </h2>
              </div>

              <div className="space-y-2.5 md:space-y-3">
                {displayCampaign.tasks.map((task) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200/80 px-3 py-2.5 md:px-4 md:py-3 dark:border-gray-800"
                    key={`${displayCampaign.id}-${task.label}`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5 text-[13px] text-gray-900 md:gap-3 md:text-sm dark:text-gray-100">
                      {renderTaskIcon(task.state)}
                      <span className="truncate">{task.label}</span>
                    </span>
                    {task.progressLabel ? (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-[10px] text-gray-600 md:px-2.5 md:py-1 md:text-[11px] dark:bg-gray-900 dark:text-gray-300">
                        {task.progressLabel}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card
            className="hidden border border-gray-200/70 bg-white p-5 xl:block dark:border-gray-800 dark:bg-black"
            forceRounded
          >
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-950 text-lg dark:text-gray-50">
                Campaign brief
              </h2>
              <p className="text-gray-600 text-sm leading-7 dark:text-gray-400">
                {displayCampaign.about}
              </p>

              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900">
                <p className="text-gray-500 text-xs uppercase tracking-[0.2em] dark:text-gray-400">
                  Reward note
                </p>
                <p className="mt-2 font-semibold text-gray-950 dark:text-gray-50">
                  Reward distribution settles after the FanDrop window closes.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default FanDropDetail;
