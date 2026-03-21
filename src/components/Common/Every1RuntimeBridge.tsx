import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  buildReferralLink,
  captureReferralJoin,
  EVERY1_DAILY_STREAK_DASHBOARD_QUERY_KEY,
  EVERY1_MISSIONS_QUERY_KEY,
  EVERY1_MOBILE_NAV_BADGE_COUNTS_QUERY_KEY,
  EVERY1_NOTIFICATION_COUNT_QUERY_KEY,
  EVERY1_NOTIFICATIONS_QUERY_KEY,
  EVERY1_PROFILE_QUERY_KEY,
  EVERY1_REFERRAL_DASHBOARD_QUERY_KEY,
  markMobileNavBadgeSeen,
  normalizeReferralCode,
  recordDailyLoginStreak,
  syncEvery1Profile
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";
import useEvery1Notifications from "@/hooks/useEvery1Notifications";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

const Every1RuntimeBridge = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentAccount } = useAccountStore();
  const {
    lastToastNotificationId,
    pendingReferralCode,
    profile,
    setLastToastNotificationId,
    setPendingReferralCode,
    setProfile
  } = useEvery1Store();
  const hasConfiguredSupabase = hasSupabaseConfig();
  const hasSyncedProfile = useRef(false);
  const lastStreakCheckKey = useRef<null | string>(null);
  const lastBadgeMarkKey = useRef<null | string>(null);

  const notificationQuery = useEvery1Notifications({
    limit: 10,
    refetchInterval: 15000,
    scope: "runtime"
  });

  const latestNotification = useMemo(
    () => notificationQuery.data?.[0] || null,
    [notificationQuery.data]
  );
  const newestUnreadNotification = useMemo(
    () =>
      notificationQuery.data?.find((notification) => !notification.isRead) ||
      null,
    [notificationQuery.data]
  );

  useEffect(() => {
    if (!hasConfiguredSupabase) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const referralCode = normalizeReferralCode(params.get("ref"));

    if (!referralCode) {
      return;
    }

    setPendingReferralCode(referralCode);
    params.delete("ref");
    navigate(
      {
        hash: location.hash,
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : ""
      },
      { replace: true }
    );
  }, [
    hasConfiguredSupabase,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    setPendingReferralCode
  ]);

  useEffect(() => {
    if (!hasConfiguredSupabase) {
      return;
    }

    if (!currentAccount) {
      hasSyncedProfile.current = false;
      setProfile(null);
      return;
    }

    let cancelled = false;

    const syncProfile = async () => {
      try {
        const syncedProfile = await syncEvery1Profile(currentAccount);

        if (cancelled) {
          return;
        }

        setProfile(syncedProfile);
        hasSyncedProfile.current = true;
        queryClient.setQueryData(
          [EVERY1_PROFILE_QUERY_KEY, syncedProfile.id],
          syncedProfile
        );
      } catch (error) {
        console.error("Failed to sync Every1 profile", error);
      }
    };

    void syncProfile();

    return () => {
      cancelled = true;
    };
  }, [currentAccount, hasConfiguredSupabase, queryClient, setProfile]);

  useEffect(() => {
    if (!hasConfiguredSupabase || !profile?.id || !pendingReferralCode) {
      return;
    }

    let cancelled = false;

    const connectReferral = async () => {
      try {
        const result = await captureReferralJoin(
          profile.id,
          pendingReferralCode
        );

        if (cancelled) {
          return;
        }

        if (result.captured) {
          toast.success("Referral linked", {
            description: `Your inviter earned ${
              result.e1xpAwarded || 50
            } E1XP now. Your first trade unlocks more.`
          });
        }

        setPendingReferralCode(null);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [EVERY1_REFERRAL_DASHBOARD_QUERY_KEY, profile.id]
          }),
          queryClient.invalidateQueries({
            queryKey: [EVERY1_NOTIFICATIONS_QUERY_KEY, profile.id]
          }),
          queryClient.invalidateQueries({
            queryKey: [EVERY1_NOTIFICATION_COUNT_QUERY_KEY, profile.id]
          })
        ]);
      } catch (error) {
        console.error("Failed to capture referral join", error);
      }
    };

    void connectReferral();

    return () => {
      cancelled = true;
    };
  }, [
    hasConfiguredSupabase,
    pendingReferralCode,
    profile?.id,
    queryClient,
    setPendingReferralCode
  ]);

  useEffect(() => {
    if (
      !hasConfiguredSupabase ||
      !profile?.id ||
      lastToastNotificationId ||
      !latestNotification
    ) {
      return;
    }

    setLastToastNotificationId(latestNotification.id);
  }, [
    hasConfiguredSupabase,
    lastToastNotificationId,
    latestNotification,
    profile?.id,
    setLastToastNotificationId
  ]);

  useEffect(() => {
    if (!hasConfiguredSupabase || !profile?.id || !newestUnreadNotification) {
      return;
    }

    if (lastToastNotificationId === newestUnreadNotification.id) {
      return;
    }

    const description =
      newestUnreadNotification.body ||
      (newestUnreadNotification.kind === "referral"
        ? `Open your rewards page to manage ${buildReferralLink(profile.referralCode)}`
        : undefined);

    if (
      newestUnreadNotification.kind === "referral" ||
      newestUnreadNotification.kind === "reward"
    ) {
      toast.success(newestUnreadNotification.title, { description });
    } else {
      toast(newestUnreadNotification.title, { description });
    }

    setLastToastNotificationId(newestUnreadNotification.id);
  }, [
    hasConfiguredSupabase,
    lastToastNotificationId,
    newestUnreadNotification,
    profile?.id,
    profile?.referralCode,
    setLastToastNotificationId
  ]);

  useEffect(() => {
    if (!hasConfiguredSupabase || !currentAccount || !profile?.id) {
      return;
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const checkKey = `${profile.id}:${todayKey}`;

    if (lastStreakCheckKey.current === checkKey) {
      return;
    }

    lastStreakCheckKey.current = checkKey;
    let cancelled = false;

    const checkInDailyStreak = async () => {
      try {
        const result = await recordDailyLoginStreak(profile.id);

        if (cancelled || !result.claimed) {
          return;
        }

        if (result.notificationId) {
          setLastToastNotificationId(result.notificationId);
        }

        toast.success(`Daily streak claimed: day ${result.currentStreak}`, {
          description: `+${result.rewardE1xp} E1XP added to your balance.`
        });

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
      } catch (error) {
        console.error("Failed to record daily streak", error);
      }
    };

    void checkInDailyStreak();

    return () => {
      cancelled = true;
    };
  }, [
    currentAccount,
    hasConfiguredSupabase,
    profile?.id,
    queryClient,
    setLastToastNotificationId
  ]);

  useEffect(() => {
    if (!hasConfiguredSupabase || !profile?.id) {
      return;
    }

    const badgeKey = location.pathname.startsWith("/leaderboard")
      ? "leaderboard_updates"
      : location.pathname.startsWith("/creators")
        ? "creators_new_profiles"
        : location.pathname === "/"
          ? "explore_new_coins"
          : null;

    if (!badgeKey) {
      return;
    }

    const markKey = `${profile.id}:${badgeKey}:${location.key}`;

    if (lastBadgeMarkKey.current === markKey) {
      return;
    }

    lastBadgeMarkKey.current = markKey;
    let cancelled = false;

    const markBadgeAsSeen = async () => {
      try {
        await markMobileNavBadgeSeen(profile.id, badgeKey);

        if (cancelled) {
          return;
        }

        await queryClient.invalidateQueries({
          queryKey: [EVERY1_MOBILE_NAV_BADGE_COUNTS_QUERY_KEY, profile.id]
        });
      } catch (error) {
        console.error("Failed to mark mobile badge as seen", error);
      }
    };

    void markBadgeAsSeen();

    return () => {
      cancelled = true;
    };
  }, [
    hasConfiguredSupabase,
    location.key,
    location.pathname,
    profile?.id,
    queryClient
  ]);

  return null;
};

export default Every1RuntimeBridge;
