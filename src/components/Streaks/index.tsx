import {
  CalendarDaysIcon,
  CheckIcon,
  FireIcon,
  SparklesIcon,
  TrophyIcon
} from "@heroicons/react/24/solid";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import RewardsPageTabs from "@/components/Rewards/RewardsPageTabs";
import Loader from "@/components/Shared/Loader";
import NotLoggedIn from "@/components/Shared/NotLoggedIn";
import PageLayout from "@/components/Shared/PageLayout";
import { Button, Card, EmptyState, ErrorMessage } from "@/components/Shared/UI";
import formatRelativeOrAbsolute from "@/helpers/datetime/formatRelativeOrAbsolute";
import {
  claimMissionReward,
  EVERY1_DAILY_STREAK_DASHBOARD_QUERY_KEY,
  EVERY1_MISSIONS_QUERY_KEY,
  EVERY1_NOTIFICATION_COUNT_QUERY_KEY,
  EVERY1_NOTIFICATIONS_QUERY_KEY,
  recordDailyLoginStreak
} from "@/helpers/every1";
import nFormatter from "@/helpers/nFormatter";
import useDailyStreakDashboard from "@/hooks/useDailyStreakDashboard";
import useProfileMissions from "@/hooks/useProfileMissions";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

const Streaks = () => {
  const queryClient = useQueryClient();
  const { currentAccount } = useAccountStore();
  const { profile, setLastToastNotificationId } = useEvery1Store();
  const { data, error, isLoading } = useDailyStreakDashboard();
  const {
    data: streakMissions,
    error: streakMissionsError,
    isLoading: isLoadingStreakMissions
  } = useProfileMissions({
    scope: "streaks",
    taskType: "streak_check_in"
  });
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimingMissionId, setClaimingMissionId] = useState<null | string>(
    null
  );

  const completedWeekCount = useMemo(
    () => data?.last7Days.filter((day) => day.completed).length || 0,
    [data?.last7Days]
  );
  const claimableMissionCount = useMemo(
    () =>
      streakMissions?.filter(
        (mission) => mission.availableToClaim && !mission.claimedAt
      ).length || 0,
    [streakMissions]
  );
  const claimedMissionCount = useMemo(
    () =>
      streakMissions?.filter((mission) => mission.progressStatus === "claimed")
        .length || 0,
    [streakMissions]
  );
  const claimableMissionE1xp = useMemo(
    () =>
      (streakMissions || [])
        .filter((mission) => mission.availableToClaim && !mission.claimedAt)
        .reduce((total, mission) => total + mission.rewardE1xp, 0),
    [streakMissions]
  );

  if (!currentAccount) {
    return <NotLoggedIn />;
  }

  const handleClaimToday = async () => {
    if (!profile?.id || isClaiming) {
      return;
    }

    setIsClaiming(true);

    try {
      const result = await recordDailyLoginStreak(profile.id);

      if (result.notificationId) {
        setLastToastNotificationId(result.notificationId);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [EVERY1_DAILY_STREAK_DASHBOARD_QUERY_KEY, profile.id]
        }),
        queryClient.invalidateQueries({
          queryKey: [EVERY1_MISSIONS_QUERY_KEY, profile.id]
        }),
        queryClient.invalidateQueries({
          queryKey: [EVERY1_NOTIFICATIONS_QUERY_KEY, profile.id]
        }),
        queryClient.invalidateQueries({
          queryKey: [EVERY1_NOTIFICATION_COUNT_QUERY_KEY, profile.id]
        })
      ]);

      if (result.claimed) {
        toast.success(`Day ${result.currentStreak} streak secured`, {
          description: `+${result.rewardE1xp} E1XP added to your balance.`
        });
        return;
      }

      toast.message("Already checked in today", {
        description: `Come back tomorrow to earn another ${data?.todayRewardE1xp || 25} E1XP.`
      });
    } catch (claimError) {
      console.error("Failed to claim daily streak", claimError);
      toast.error("Couldn't claim today's streak reward");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleClaimMission = async (missionId: string) => {
    if (!profile?.id || claimingMissionId) {
      return;
    }

    setClaimingMissionId(missionId);

    try {
      const result = await claimMissionReward(profile.id, missionId);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [EVERY1_MISSIONS_QUERY_KEY, profile.id]
        }),
        queryClient.invalidateQueries({
          queryKey: [EVERY1_DAILY_STREAK_DASHBOARD_QUERY_KEY, profile.id]
        }),
        queryClient.invalidateQueries({
          queryKey: [EVERY1_NOTIFICATIONS_QUERY_KEY, profile.id]
        }),
        queryClient.invalidateQueries({
          queryKey: [EVERY1_NOTIFICATION_COUNT_QUERY_KEY, profile.id]
        })
      ]);

      if (result.claimed) {
        if (result.notificationId) {
          setLastToastNotificationId(result.notificationId);
        }

        toast.success(result.missionTitle || "Mission claimed", {
          description: `+${result.rewardE1xp || 0} E1XP added to your balance.`
        });
        return;
      }

      toast.message("Mission not claimable yet", {
        description: result.reason || "Keep your streak going to unlock this."
      });
    } catch (claimError) {
      console.error("Failed to claim mission reward", claimError);
      toast.error("Couldn't claim this mission reward");
    } finally {
      setClaimingMissionId(null);
    }
  };

  return (
    <PageLayout hideSearch title="Daily Streaks">
      {isLoading || !profile?.id ? (
        <Card className="mx-4 p-3.5 md:mx-0 md:p-5" forceRounded>
          <div className="flex min-h-48 items-center justify-center">
            <Loader />
          </div>
        </Card>
      ) : error ? (
        <ErrorMessage
          className="mx-4 md:mx-0"
          error={error}
          title="Failed to load streak dashboard"
        />
      ) : data ? (
        <div className="space-y-2.5">
          <div className="mx-4 md:mx-0">
            <RewardsPageTabs />
          </div>

          <Card
            className="mx-4 overflow-hidden p-3.5 md:mx-0 md:p-5"
            forceRounded
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-300">
                  <FireIcon className="size-3.5 md:size-4" />
                  <span className="font-medium text-[10px] uppercase tracking-[0.14em] md:text-[11px] md:tracking-[0.16em]">
                    Current streak
                  </span>
                </div>

                <div className="flex items-end gap-2">
                  <h2 className="font-semibold text-3xl text-gray-950 leading-none md:text-5xl dark:text-gray-50">
                    {data.currentStreak}
                  </h2>
                  <p className="pb-0.5 font-medium text-[11px] text-gray-500 md:text-sm dark:text-gray-400">
                    days
                  </p>
                </div>

                <p className="hidden max-w-lg text-gray-500 text-xs md:block md:text-sm dark:text-gray-400">
                  {data.claimedToday
                    ? "Checked in for today. Your reward is secured."
                    : "Log in today to keep your streak alive."}
                </p>

                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-[11px] text-gray-700 md:px-2.5 md:py-1 md:text-xs dark:bg-gray-900 dark:text-gray-200">
                    Longest {data.longestStreak}
                  </span>
                  <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 font-semibold text-[11px] text-fuchsia-700 md:px-2.5 md:py-1 md:text-xs dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
                    +{data.todayRewardE1xp} today
                  </span>
                  <span className="hidden rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-[11px] text-amber-700 md:inline-flex md:px-2.5 md:py-1 md:text-xs dark:bg-amber-500/10 dark:text-amber-300">
                    Day {data.nextMilestone} next
                  </span>
                  <div className="flex items-center gap-1 md:hidden">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-[11px] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                      {data.claimedToday
                        ? "Claimed"
                        : `+${data.todayRewardE1xp}`}
                    </span>
                    <Button
                      className="h-6 min-w-0 rounded-full px-2"
                      disabled={data.claimedToday || isClaiming}
                      onClick={handleClaimToday}
                      size="sm"
                    >
                      {data.claimedToday ? (
                        <CheckIcon className="size-3.5" />
                      ) : isClaiming ? (
                        "..."
                      ) : (
                        "Claim"
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="hidden w-full max-w-sm rounded-[1rem] border border-gray-200 bg-gray-50 p-2.5 md:block md:rounded-[1.25rem] md:p-3.5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-2 md:block">
                  <div>
                    <p className="font-semibold text-gray-950 text-sm md:text-base dark:text-gray-50">
                      Daily check-in
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500 md:hidden dark:text-gray-400">
                      {data.claimedToday
                        ? "Claimed"
                        : `+${data.todayRewardE1xp} E1XP`}
                    </p>
                    <p className="mt-0.5 hidden text-[11px] text-gray-500 md:block md:text-sm dark:text-gray-400">
                      {data.claimedToday
                        ? "Already claimed today."
                        : `Claim +${data.todayRewardE1xp} E1XP.`}
                    </p>
                  </div>
                  <SparklesIcon className="hidden size-5 text-fuchsia-500 md:block md:size-6 dark:text-fuchsia-300" />

                  <Button
                    className="shrink-0 md:mt-3 md:w-full"
                    disabled={data.claimedToday || isClaiming}
                    onClick={handleClaimToday}
                    size="sm"
                  >
                    {data.claimedToday
                      ? "Done"
                      : isClaiming
                        ? "Claiming..."
                        : "Claim"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-2.5 xl:grid-cols-[1.05fr_0.95fr]">
            <Card
              className="mx-4 overflow-hidden p-3.5 md:mx-0 md:p-5"
              forceRounded
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-base text-gray-950 md:text-lg dark:text-gray-50">
                    This week
                  </h3>
                  <p className="mt-0.5 text-[11px] text-gray-500 md:text-sm dark:text-gray-400">
                    {completedWeekCount}/7 days complete
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-[10px] text-amber-700 md:px-2.5 md:py-1 md:text-[11px] dark:bg-amber-500/10 dark:text-amber-300">
                  +{data.nextMilestoneRewardE1xp}
                  <span className="hidden md:inline">
                    {" "}
                    at day {data.nextMilestone}
                  </span>
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-7 gap-1 md:gap-2">
                {data.last7Days.map((day) => (
                  <div
                    className={`rounded-lg border px-0.5 py-1.5 text-center md:rounded-xl md:px-2 md:py-2.5 ${
                      day.isToday
                        ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10"
                        : day.completed
                          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-black"
                    }`}
                    key={day.date}
                  >
                    <p className="font-medium text-[10px] text-gray-500 uppercase tracking-[0.12em] dark:text-gray-400">
                      {day.label}
                    </p>
                    <div className="mt-1.5 flex justify-center md:mt-2.5">
                      <span
                        className={`flex size-5.5 items-center justify-center rounded-full text-[10px] md:size-7 md:text-xs ${
                          day.completed
                            ? "bg-emerald-500 text-white"
                            : day.isToday
                              ? "bg-blue-500 text-white"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                        }`}
                      >
                        {day.completed ? (
                          <CheckIcon className="size-3.5 md:size-4" />
                        ) : (
                          day.dayOfMonth
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card
              className="mx-4 hidden p-3.5 md:mx-0 md:block md:p-5"
              forceRounded
            >
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                <div className="rounded-xl border border-gray-200 bg-white p-2.5 md:rounded-2xl md:p-4 dark:border-gray-800 dark:bg-black">
                  <div className="mb-1 flex items-center gap-1 text-gray-500 md:mb-2 md:gap-2 dark:text-gray-400">
                    <CalendarDaysIcon className="size-4" />
                    <span className="text-[10px] uppercase tracking-[0.16em] md:text-xs md:tracking-[0.18em]">
                      Week
                    </span>
                  </div>
                  <p className="font-semibold text-base text-gray-950 md:text-2xl dark:text-gray-50">
                    {completedWeekCount}/7
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-2.5 md:rounded-2xl md:p-4 dark:border-gray-800 dark:bg-black">
                  <div className="mb-1 flex items-center gap-1 text-gray-500 md:mb-2 md:gap-2 dark:text-gray-400">
                    <SparklesIcon className="size-4" />
                    <span className="text-[10px] uppercase tracking-[0.16em] md:text-xs md:tracking-[0.18em]">
                      E1XP
                    </span>
                  </div>
                  <p className="font-semibold text-base text-gray-950 md:text-2xl dark:text-gray-50">
                    {nFormatter(data.totalStreakE1xp, 1)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-2.5 md:rounded-2xl md:p-4 dark:border-gray-800 dark:bg-black">
                  <div className="mb-1 flex items-center gap-1 text-gray-500 md:mb-2 md:gap-2 dark:text-gray-400">
                    <TrophyIcon className="size-4" />
                    <span className="text-[10px] uppercase tracking-[0.16em] md:text-xs md:tracking-[0.18em]">
                      Next
                    </span>
                  </div>
                  <p className="font-semibold text-base text-gray-950 md:text-2xl dark:text-gray-50">
                    {data.nextMilestone}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="mx-4 p-3.5 md:mx-0 md:p-5" forceRounded>
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="font-semibold text-base text-gray-950 md:text-lg dark:text-gray-50">
                  Streak missions
                </h3>
                <p className="mt-0.5 hidden text-gray-500 text-xs md:block md:text-sm dark:text-gray-400">
                  Extra E1XP quests that unlock as your login streak grows.
                </p>
              </div>

              <div className="flex flex-wrap gap-1">
                <span className="hidden rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-[11px] text-gray-700 md:inline-flex md:px-2.5 md:py-1 md:text-xs dark:bg-gray-900 dark:text-gray-200">
                  Claimed {claimedMissionCount}
                </span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-[11px] text-blue-700 md:px-2.5 md:py-1 md:text-xs dark:bg-blue-500/10 dark:text-blue-300">
                  Ready {claimableMissionCount}
                </span>
                <span className="hidden rounded-full bg-fuchsia-100 px-2 py-0.5 font-semibold text-[11px] text-fuchsia-700 md:inline-flex md:px-2.5 md:py-1 md:text-xs dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
                  +{nFormatter(claimableMissionE1xp, 1)} E1XP
                </span>
              </div>
            </div>

            <div className="mt-3">
              {isLoadingStreakMissions ? (
                <div className="flex min-h-40 items-center justify-center">
                  <Loader />
                </div>
              ) : streakMissionsError ? (
                <ErrorMessage
                  error={streakMissionsError}
                  title="Failed to load streak missions"
                />
              ) : streakMissions?.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {streakMissions.map((mission) => {
                    const isClaimingMission = claimingMissionId === mission.id;
                    const isClaimed = mission.progressStatus === "claimed";

                    return (
                      <div
                        className={`${isClaimed ? "hidden md:block" : "block"} rounded-[1rem] border border-gray-200 bg-gray-50 p-3 md:rounded-[1.25rem] md:p-3.5 dark:border-gray-800 dark:bg-gray-900`}
                        key={mission.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-950 text-sm md:text-base dark:text-gray-50">
                              {mission.title}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-fuchsia-100 px-2 py-1 font-semibold text-[10px] text-fuchsia-700 md:px-2.5 md:text-[11px] dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
                            +{mission.rewardE1xp} E1XP
                          </span>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <p className="font-medium text-[11px] text-gray-600 md:text-sm dark:text-gray-300">
                            {mission.currentValue}/{mission.targetValue} days
                          </p>
                          <span
                            className={`rounded-full px-2 py-1 font-semibold text-[10px] md:px-2.5 md:text-[11px] ${
                              isClaimed
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                : mission.availableToClaim
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                                  : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                            }`}
                          >
                            {isClaimed
                              ? "Claimed"
                              : mission.availableToClaim
                                ? "Ready"
                                : "In progress"}
                          </span>
                        </div>

                        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-200 md:h-2 dark:bg-gray-800">
                          <div
                            className={`h-full rounded-full transition-[width] duration-500 ${
                              isClaimed
                                ? "bg-emerald-500"
                                : mission.availableToClaim
                                  ? "bg-blue-500"
                                  : "bg-orange-400"
                            }`}
                            style={{ width: `${mission.percentComplete}%` }}
                          />
                        </div>

                        <div className="mt-2.5 flex items-center justify-end gap-3">
                          <Button
                            className="shrink-0"
                            disabled={!mission.availableToClaim || isClaimed}
                            onClick={() => handleClaimMission(mission.id)}
                            size="sm"
                          >
                            {isClaimed
                              ? "Claimed"
                              : isClaimingMission
                                ? "Claiming..."
                                : "Claim"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  hideCard
                  icon={<SparklesIcon className="size-8" />}
                  message="Your streak missions will appear here once your profile is ready."
                />
              )}
            </div>
          </Card>

          <Card className="mx-4 p-3.5 md:mx-0 md:p-5" forceRounded>
            <div className="mb-2.5">
              <h3 className="font-semibold text-base text-gray-950 md:text-lg dark:text-gray-50">
                Recent rewards
              </h3>
            </div>

            {data.recentRewards.length ? (
              <div className="space-y-1.5 md:space-y-2">
                {data.recentRewards.slice(0, 2).map((reward) => (
                  <div
                    className="flex items-center justify-between gap-2.5 rounded-lg border border-gray-200 px-2 py-1.5 md:rounded-xl md:px-3 md:py-2.5 dark:border-gray-800"
                    key={reward.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[13px] text-gray-950 md:text-sm dark:text-gray-50">
                        {reward.description || "Daily streak reward"}
                      </p>
                      <p className="text-[11px] text-gray-500 md:text-xs dark:text-gray-400">
                        {formatRelativeOrAbsolute(reward.createdAt)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-fuchsia-100 px-2.5 py-1 font-semibold text-[11px] text-fuchsia-700 md:px-3 md:text-xs dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
                      +{reward.amount} E1XP
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                hideCard
                icon={<FireIcon className="size-8" />}
                message="Your daily login rewards will start appearing here after your first claimed streak day."
              />
            )}
          </Card>
        </div>
      ) : (
        <Card className="mx-4 p-3.5 md:mx-0 md:p-5" forceRounded>
          <EmptyState
            hideCard
            icon={<FireIcon className="size-8" />}
            message="Your daily streak dashboard will appear here once your profile is ready."
          />
        </Card>
      )}
    </PageLayout>
  );
};

export default Streaks;
