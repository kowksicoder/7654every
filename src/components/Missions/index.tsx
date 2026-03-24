import {
  CheckCircleIcon,
  ClockIcon,
  FireIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import PageLayout from "@/components/Shared/PageLayout";
import { Card, Modal } from "@/components/Shared/UI";
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
  mapEvery1FanDropToCard,
  STATIC_FANDROP_FALLBACK_CAMPAIGNS
} from "./data";

const stateBadgeStyles: Record<FanDropCampaign["state"], string> = {
  completed:
    "bg-emerald-500/14 text-emerald-700 dark:bg-emerald-500/14 dark:text-emerald-300",
  ended: "bg-white/80 text-gray-700 dark:bg-black/35 dark:text-gray-200",
  joined: "bg-sky-500/14 text-sky-700 dark:bg-sky-500/14 dark:text-sky-300",
  live: "bg-orange-500/14 text-orange-700 dark:bg-orange-500/14 dark:text-orange-300"
};

const stateLabels: Record<FanDropCampaign["state"], string> = {
  completed: "Pending",
  ended: "Ended",
  joined: "Joined",
  live: "Live"
};

const progressFillClassName: Record<FanDropCampaign["state"], string> = {
  completed: "bg-emerald-500",
  ended: "bg-gray-400 dark:bg-gray-500",
  joined: "bg-sky-500",
  live: "bg-orange-500"
};

const renderTaskIcon = (
  taskState: FanDropCampaign["tasks"][number]["state"]
) => {
  if (taskState === "complete") {
    return (
      <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
        <CheckCircleIcon className="size-3.5" />
      </span>
    );
  }

  if (taskState === "optional") {
    return (
      <span className="flex size-4 items-center justify-center rounded-full border border-gray-300 font-bold text-[8px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
        O
      </span>
    );
  }

  return (
    <span className="flex size-4 items-center justify-center rounded-full border border-gray-300 font-bold text-[8px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
      -
    </span>
  );
};

const FanDropCard = ({
  campaign,
  onOpenMobileCampaign
}: {
  campaign: FanDropCampaign;
  onOpenMobileCampaign: (campaign: FanDropCampaign) => void;
}) => {
  const progressPercent =
    campaign.progressTotal > 0
      ? (campaign.progressComplete / campaign.progressTotal) * 100
      : 0;

  return (
    <Card
      className="overflow-hidden border border-gray-200/75 bg-white p-3 md:p-3.5 dark:border-gray-800 dark:bg-gray-950"
      forceRounded
    >
      <div className="space-y-3">
        <div
          className="relative overflow-hidden rounded-[1.2rem]"
          style={{
            backgroundImage: `url(${campaign.bannerImageUrl})`,
            backgroundPosition: "center",
            backgroundSize: "cover"
          }}
        >
          <div className="absolute inset-0 bg-black/35 dark:bg-black/45" />
          <div
            className={cn(
              "absolute inset-0 opacity-75 mix-blend-multiply",
              campaign.accentClassName
            )}
          />
          <div className="relative flex min-h-24 flex-col justify-between px-3 py-3 text-white md:min-h-28">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[10px] backdrop-blur",
                  stateBadgeStyles[campaign.state]
                )}
              >
                <FireIcon className="size-3" />
                {stateLabels[campaign.state]}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 font-semibold text-[10px] text-white/95 backdrop-blur">
                <ClockIcon className="size-3" />
                {campaign.timeLabel}
              </span>
            </div>

            <div className="space-y-1">
              <p className="font-medium text-[10px] text-white/70 uppercase tracking-[0.18em]">
                {campaign.coverLabel}
              </p>
              <h2 className="font-semibold text-base leading-5 md:text-[1.05rem]">
                {campaign.title}
              </h2>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="truncate font-medium text-[11px] text-gray-900 dark:text-gray-100">
            {campaign.creatorName}
          </p>
          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
            {campaign.creatorHandle}
          </p>
        </div>

        <div className="space-y-1.5">
          {campaign.tasks.map((task) => (
            <div
              className="flex items-center justify-between gap-2 text-[12px]"
              key={`${campaign.id}-${task.label}`}
            >
              <span className="flex min-w-0 items-center gap-2 text-gray-800 dark:text-gray-100">
                {renderTaskIcon(task.state)}
                <span className="truncate">{task.label}</span>
              </span>
              {task.progressLabel ? (
                <span className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400">
                  {task.progressLabel}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="rounded-[1rem] bg-gray-50 px-3 py-2 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-3 text-[10px] text-gray-500 dark:text-gray-400">
            <span>Pool</span>
            <span className="font-semibold text-gray-950 dark:text-gray-50">
              {campaign.rewardPoolLabel}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-gray-500 dark:text-gray-400">
            <span>
              {campaign.progressComplete}/{campaign.progressTotal}
            </span>
            <span className="font-semibold text-gray-950 dark:text-gray-50">
              {campaign.rankLabel}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white dark:bg-black">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progressFillClassName[campaign.state]
              )}
              style={{ width: `${Math.max(progressPercent, 8)}%` }}
            />
          </div>
        </div>

        <button
          className="inline-flex w-full items-center justify-center rounded-full bg-gray-950 px-3 py-2.5 font-semibold text-[13px] text-white transition-colors hover:bg-gray-800 md:hidden dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
          onClick={() => onOpenMobileCampaign(campaign)}
          type="button"
        >
          {campaign.ctaLabel}
        </button>
        <Link
          className="hidden w-full items-center justify-center rounded-full bg-gray-950 px-3 py-2.5 font-semibold text-[13px] text-white transition-colors hover:bg-gray-800 md:inline-flex dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
          to={`/fandrop/${campaign.slug}`}
        >
          {campaign.ctaLabel}
        </Link>
      </div>
    </Card>
  );
};

const FanDrop = () => {
  const queryClient = useQueryClient();
  const { profile, setLastToastNotificationId } = useEvery1Store();
  const [selectedCampaign, setSelectedCampaign] =
    useState<FanDropCampaign | null>(null);
  const [joiningCampaignId, setJoiningCampaignId] = useState<null | string>(
    null
  );
  const fanDropsQuery = useProfileFanDrops();
  const displayCampaigns = useMemo(
    () =>
      fanDropsQuery.data?.length
        ? fanDropsQuery.data.map(mapEvery1FanDropToCard)
        : STATIC_FANDROP_FALLBACK_CAMPAIGNS,
    [fanDropsQuery.data]
  );
  const totalCount = displayCampaigns.length;
  const activeCount = displayCampaigns.filter(
    (campaign) => campaign.state !== "ended"
  ).length;
  const endedCount = displayCampaigns.filter(
    (campaign) => campaign.state === "ended"
  ).length;

  const handleCampaignCta = async (campaign: FanDropCampaign) => {
    if (campaign.state !== "live") {
      setSelectedCampaign(null);
      return;
    }

    if (!profile?.id) {
      toast.error("Sign in to join this FanDrop.");
      return;
    }

    if (joiningCampaignId) {
      return;
    }

    setJoiningCampaignId(campaign.id);

    try {
      const result = await joinFanDropCampaign(profile.id, {
        creatorName: campaign.creatorName,
        rewardPoolLabel: campaign.rewardPoolLabel,
        slug: campaign.slug,
        state: campaign.state,
        title: campaign.title
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
          ? `Already in ${campaign.title}`
          : `Joined ${campaign.title}`,
        {
          description: result.alreadyJoined
            ? "Keep your place and finish the next actions before the pool closes."
            : `${campaign.rewardPoolLabel} is in play. Hold your spot and climb the board.`
        }
      );

      setSelectedCampaign(null);
    } catch (error) {
      console.error("Failed to join FanDrop", error);
      toast.error("Couldn't join this FanDrop.");
    } finally {
      setJoiningCampaignId(null);
    }
  };

  return (
    <PageLayout
      description="Complete quick fan actions, climb the board, and lock in creator rewards before the window closes."
      hideDesktopSidebar
      title="FanDrop"
    >
      <div className="space-y-3">
        <section className="mx-5 rounded-[1.05rem] border border-gray-200/70 bg-white p-2.5 md:mx-0 md:rounded-[1.25rem] md:p-4 dark:border-gray-800 dark:bg-black">
          <div className="space-y-2 md:flex md:items-center md:justify-between md:space-y-0">
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-[9px] text-emerald-700 uppercase tracking-[0.14em] dark:text-emerald-300">
                <FireIcon className="size-3" />
                FanDrop
              </span>
              <h1 className="font-semibold text-gray-950 text-lg leading-tight md:text-xl dark:text-gray-50">
                Live fan campaigns
              </h1>
              <p className="max-w-md text-[12px] text-gray-600 leading-4 md:text-[13px] md:leading-5 dark:text-gray-400">
                Join fast and hold your rank before the pool closes.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1 text-[9px] md:flex md:flex-wrap md:gap-1.5 md:text-[10px]">
              <span className="rounded-full bg-gray-100 px-1.5 py-0.75 text-center font-semibold text-gray-700 md:px-2.5 md:py-1 dark:bg-gray-900 dark:text-gray-300">
                {totalCount} drops
              </span>
              <span className="rounded-full bg-gray-100 px-1.5 py-0.75 text-center font-semibold text-gray-700 md:px-2.5 md:py-1 dark:bg-gray-900 dark:text-gray-300">
                {activeCount} active
              </span>
              <span className="rounded-full bg-gray-100 px-1.5 py-0.75 text-center font-semibold text-gray-700 md:px-2.5 md:py-1 dark:bg-gray-900 dark:text-gray-300">
                {endedCount} closed
              </span>
            </div>
          </div>
        </section>

        <section className="mx-5 md:mx-0">
          <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
            {displayCampaigns.map((campaign) => (
              <FanDropCard
                campaign={campaign}
                key={campaign.id}
                onOpenMobileCampaign={setSelectedCampaign}
              />
            ))}
          </div>
        </section>
      </div>

      <Modal
        onClose={() => setSelectedCampaign(null)}
        show={Boolean(selectedCampaign)}
        size="xs"
      >
        {selectedCampaign ? (
          <div className="md:hidden">
            <div
              className="relative overflow-hidden rounded-t-xl"
              style={{
                backgroundImage: `url(${selectedCampaign.bannerImageUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover"
              }}
            >
              <div className="absolute inset-0 bg-black/40" />
              <div
                className={cn(
                  "absolute inset-0 opacity-75 mix-blend-multiply",
                  selectedCampaign.accentClassName
                )}
              />
              <div className="relative min-h-24 px-3 py-2.5 text-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[10px] backdrop-blur",
                        stateBadgeStyles[selectedCampaign.state]
                      )}
                    >
                      <FireIcon className="size-3" />
                      {stateLabels[selectedCampaign.state]}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 font-semibold text-[10px] text-white/95 backdrop-blur">
                      <ClockIcon className="size-3" />
                      {selectedCampaign.timeLabel}
                    </span>
                  </div>

                  <button
                    className="rounded-full bg-black/20 p-1.5 text-white/90 backdrop-blur"
                    onClick={() => setSelectedCampaign(null)}
                    type="button"
                  >
                    <XMarkIcon className="size-4" />
                  </button>
                </div>

                <div className="mt-3 space-y-0.5">
                  <p className="font-medium text-[10px] text-white/70 uppercase tracking-[0.18em]">
                    {selectedCampaign.coverLabel}
                  </p>
                  <h2 className="font-semibold text-base leading-tight">
                    {selectedCampaign.title}
                  </h2>
                  <p className="text-[11px] text-white/80">
                    {selectedCampaign.creatorName} /{" "}
                    {selectedCampaign.creatorHandle}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 p-3">
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-[0.9rem] bg-gray-50 px-2 py-1.5 dark:bg-gray-900">
                  <p className="text-[10px] text-gray-500 uppercase tracking-[0.14em] dark:text-gray-400">
                    Pool
                  </p>
                  <p className="mt-0.5 font-semibold text-[11px] text-gray-950 leading-3.5 dark:text-gray-50">
                    {selectedCampaign.rewardPoolLabel}
                  </p>
                </div>
                <div className="rounded-[0.9rem] bg-gray-50 px-2 py-1.5 dark:bg-gray-900">
                  <p className="text-[10px] text-gray-500 uppercase tracking-[0.14em] dark:text-gray-400">
                    Rank
                  </p>
                  <p className="mt-0.5 font-semibold text-[11px] text-gray-950 leading-3.5 dark:text-gray-50">
                    {selectedCampaign.rankLabel}
                  </p>
                </div>
                <div className="rounded-[0.9rem] bg-gray-50 px-2 py-1.5 dark:bg-gray-900">
                  <p className="text-[10px] text-gray-500 uppercase tracking-[0.14em] dark:text-gray-400">
                    Progress
                  </p>
                  <p className="mt-0.5 font-semibold text-[11px] text-gray-950 leading-3.5 dark:text-gray-50">
                    {selectedCampaign.progressComplete}/
                    {selectedCampaign.progressTotal}
                  </p>
                </div>
              </div>

              <div className="rounded-[0.9rem] bg-gray-50 px-2.5 py-2 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>{selectedCampaign.tasks.length} actions</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Quick confirm
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white dark:bg-black">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      progressFillClassName[selectedCampaign.state]
                    )}
                    style={{
                      width: `${Math.max(
                        selectedCampaign.progressTotal > 0
                          ? (selectedCampaign.progressComplete /
                              selectedCampaign.progressTotal) *
                              100
                          : 0,
                        8
                      )}%`
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                {selectedCampaign.tasks.slice(0, 3).map((task) => (
                  <div
                    className="flex items-center justify-between gap-2 rounded-[0.9rem] border border-gray-200/80 px-2.5 py-1.5 dark:border-gray-800"
                    key={`${selectedCampaign.id}-modal-${task.label}`}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-[12px] text-gray-800 dark:text-gray-100">
                      {renderTaskIcon(task.state)}
                      <span className="truncate">{task.label}</span>
                    </span>
                    {task.progressLabel ? (
                      <span className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400">
                        {task.progressLabel}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="flex">
                <button
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-gray-950 px-3 py-2 font-semibold text-[12px] text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
                  disabled={joiningCampaignId === selectedCampaign.id}
                  onClick={() => void handleCampaignCta(selectedCampaign)}
                  type="button"
                >
                  {joiningCampaignId === selectedCampaign.id
                    ? "Joining..."
                    : selectedCampaign.ctaLabel}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageLayout>
  );
};

export default FanDrop;
