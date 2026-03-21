import getAvatar from "@/helpers/getAvatar";
import sanitizeDStorageUrl from "@/helpers/sanitizeDStorageUrl";
import { getSupabaseClient } from "@/helpers/supabase";
import type { AccountFragment } from "@/indexer/generated";
import type {
  DailyStreakClaimResult,
  DailyStreakDashboard,
  Every1Mission,
  Every1MobileNavBadgeCounts,
  Every1MobileNavBadgeKey,
  Every1MobileNavBadgeSeenResult,
  Every1Notification,
  Every1Profile,
  MissionClaimResult,
  ReferralDashboard,
  ReferralJoinResult,
  ReferralRewardResult
} from "@/types/every1";

export const EVERY1_PROFILE_QUERY_KEY = "every1-profile";
export const EVERY1_REFERRAL_DASHBOARD_QUERY_KEY = "every1-referral-dashboard";
export const EVERY1_NOTIFICATIONS_QUERY_KEY = "every1-notifications";
export const EVERY1_NOTIFICATION_COUNT_QUERY_KEY = "every1-notification-count";
export const EVERY1_DAILY_STREAK_DASHBOARD_QUERY_KEY =
  "every1-daily-streak-dashboard";
export const EVERY1_MISSIONS_QUERY_KEY = "every1-missions";
export const EVERY1_MOBILE_NAV_BADGE_COUNTS_QUERY_KEY =
  "every1-mobile-nav-badge-counts";

const callRpc = async <TData>(
  fn: string,
  args?: Record<string, unknown>
): Promise<TData> => {
  const { data, error } = await getSupabaseClient().rpc(fn, args);

  if (error) {
    throw error;
  }

  return data as TData;
};

const asRemoteAsset = (value?: null | string) => {
  const sanitized = sanitizeDStorageUrl(value || undefined);

  return /^https?:\/\//.test(sanitized) ? sanitized : null;
};

const getPreferredUsername = (account: AccountFragment) =>
  account.username?.localName ||
  account.username?.value?.split("/").pop() ||
  null;

const getCoverPicture = (account: AccountFragment) =>
  typeof account.metadata?.coverPicture === "string"
    ? account.metadata.coverPicture
    : null;

export const normalizeReferralCode = (value?: null | string) => {
  const normalized = (value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return normalized || null;
};

export const buildReferralLink = (referralCode?: null | string) => {
  const normalized = normalizeReferralCode(referralCode);

  if (!normalized) {
    return "";
  }

  if (typeof window === "undefined") {
    return `/?ref=${normalized}`;
  }

  const url = new URL("/", window.location.origin);
  url.searchParams.set("ref", normalized);

  return url.toString();
};

export const syncEvery1Profile = async (account: AccountFragment) => {
  const displayName = account.metadata?.name || getPreferredUsername(account);

  try {
    return await callRpc<Every1Profile>("upsert_external_profile", {
      input_avatar_url: asRemoteAsset(getAvatar(account)),
      input_banner_url: asRemoteAsset(getCoverPicture(account)),
      input_bio: account.metadata?.bio || null,
      input_display_name: displayName,
      input_lens_account_address: account.address,
      input_username: getPreferredUsername(account),
      input_wallet_address: account.owner,
      input_zora_handle: getPreferredUsername(account)
    });
  } catch {
    return callRpc<Every1Profile>("upsert_external_profile", {
      input_avatar_url: asRemoteAsset(getAvatar(account)),
      input_banner_url: asRemoteAsset(getCoverPicture(account)),
      input_bio: account.metadata?.bio || null,
      input_display_name: displayName,
      input_lens_account_address: account.address,
      input_username: null,
      input_wallet_address: account.owner,
      input_zora_handle: getPreferredUsername(account)
    });
  }
};

export const captureReferralJoin = async (
  profileId: string,
  referralCode: string
) =>
  callRpc<ReferralJoinResult>("capture_referral_join", {
    input_profile_id: profileId,
    input_referral_code: normalizeReferralCode(referralCode)
  });

export const recordReferralTradeReward = async (input: {
  chainId?: number;
  coinAddress: string;
  coinSymbol: string;
  profileId: string;
  tradeAmountIn: number;
  tradeAmountOut: number;
  tradeSide: "buy" | "sell";
  txHash: string;
}) =>
  callRpc<ReferralRewardResult>("record_referral_trade_reward", {
    input_chain_id: input.chainId ?? 8453,
    input_coin_address: input.coinAddress,
    input_coin_symbol: input.coinSymbol,
    input_profile_id: input.profileId,
    input_trade_amount_in: input.tradeAmountIn,
    input_trade_amount_out: input.tradeAmountOut,
    input_trade_side: input.tradeSide,
    input_tx_hash: input.txHash
  });

export const getReferralDashboard = async (profileId: string) =>
  callRpc<ReferralDashboard>("get_referral_dashboard", {
    input_profile_id: profileId
  });

export const getDailyStreakDashboard = async (profileId: string) =>
  callRpc<DailyStreakDashboard>("get_daily_streak_dashboard", {
    input_profile_id: profileId
  });

export const recordDailyLoginStreak = async (profileId: string) =>
  callRpc<DailyStreakClaimResult>("record_daily_login_streak", {
    input_profile_id: profileId
  });

export const getProfileMissions = async (
  profileId: string,
  taskType?: null | string
) =>
  callRpc<Every1Mission[]>("get_profile_missions", {
    input_profile_id: profileId,
    input_task_type: taskType || null
  });

export const claimMissionReward = async (
  profileId: string,
  missionId: string
) =>
  callRpc<MissionClaimResult>("claim_mission_reward", {
    input_mission_id: missionId,
    input_profile_id: profileId
  });

export const listProfileNotifications = async (
  profileId: string,
  {
    kind,
    limit = 50
  }: {
    kind?: null | string;
    limit?: number;
  } = {}
) => {
  const rows = await callRpc<
    Array<{
      actor_avatar_url: null | string;
      actor_display_name: null | string;
      actor_id: null | string;
      actor_username: null | string;
      body: null | string;
      created_at: string;
      data: Record<string, unknown>;
      id: string;
      is_read: boolean;
      kind: Every1Notification["kind"];
      target_key: null | string;
      title: string;
    }>
  >("list_profile_notifications", {
    input_kind: kind || null,
    input_limit: limit,
    input_profile_id: profileId
  });

  return rows.map((row) => ({
    actorAvatarUrl: row.actor_avatar_url,
    actorDisplayName: row.actor_display_name,
    actorId: row.actor_id,
    actorUsername: row.actor_username,
    body: row.body,
    createdAt: row.created_at,
    data: row.data || {},
    id: row.id,
    isRead: row.is_read,
    kind: row.kind,
    targetKey: row.target_key,
    title: row.title
  })) satisfies Every1Notification[];
};

export const getUnreadNotificationCount = async (profileId: string) =>
  callRpc<number>("get_profile_unread_notification_count", {
    input_profile_id: profileId
  });

export const markNotificationsRead = async (
  profileId: string,
  notificationIds?: string[]
) =>
  callRpc<number>("mark_profile_notifications_read", {
    input_notification_ids:
      notificationIds && notificationIds.length > 0 ? notificationIds : null,
    input_profile_id: profileId
  });

export const getMobileNavBadgeCounts = async (profileId: string) =>
  callRpc<Every1MobileNavBadgeCounts>("get_mobile_nav_badge_counts", {
    input_profile_id: profileId
  });

export const getPublicE1xpTotalsByWallets = async (
  walletAddresses: string[]
) => {
  const normalizedAddresses = Array.from(
    new Set(
      walletAddresses
        .map((address) => address?.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (!normalizedAddresses.length) {
    return {} as Record<string, number>;
  }

  const rows = await callRpc<
    Array<{
      total_e1xp: number | string;
      wallet_address: string;
    }>
  >("get_public_profile_e1xp_by_wallets", {
    input_wallet_addresses: normalizedAddresses
  });

  return Object.fromEntries(
    rows.map((row) => [
      row.wallet_address.toLowerCase(),
      Number.parseInt(String(row.total_e1xp || 0), 10) || 0
    ])
  ) as Record<string, number>;
};

export const markMobileNavBadgeSeen = async (
  profileId: string,
  badgeKey: Every1MobileNavBadgeKey
) =>
  callRpc<Every1MobileNavBadgeSeenResult>("mark_mobile_nav_badge_seen", {
    input_badge_key: badgeKey,
    input_profile_id: profileId
  });
