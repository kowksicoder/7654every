export interface Every1Profile {
  id: string;
  username: null | string;
  displayName: null | string;
  bio: null | string;
  avatarUrl: null | string;
  bannerUrl: null | string;
  walletAddress: null | string;
  lensAccountAddress: null | string;
  zoraHandle: null | string;
  referralCode: null | string;
  e1xpTotal: number;
}

export interface ReferralDashboardProfile {
  id: string;
  username: null | string;
  displayName: null | string;
  avatarUrl: null | string;
  walletAddress: null | string;
  lensAccountAddress: null | string;
}

export interface ReferralDashboardStats {
  joinedCount: number;
  rewardedCount: number;
  totalE1xp: number;
  totalCoinRewards: number;
}

export interface ReferralRecentEntry {
  id: string;
  status: string;
  joinedAt: null | string;
  rewardedAt: null | string;
  rewardE1xp: number;
  referredProfileId: string;
  displayName: null | string;
  username: null | string;
  avatarUrl: null | string;
  walletAddress: null | string;
}

export interface ReferralTradeRewardEntry {
  id: string;
  coinAddress: string;
  coinSymbol: string;
  rewardAmount: number;
  rewardPercent: number;
  tradeSide: "buy" | "sell";
  tradeAmountIn: number;
  tradeAmountOut: number;
  txHash: string;
  createdAt: string;
  referredProfileId: string;
  displayName: null | string;
  username: null | string;
  avatarUrl: null | string;
}

export interface E1xpLedgerEntry {
  id: string;
  source: string;
  amount: number;
  description: null | string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface DailyStreakDay {
  date: string;
  label: string;
  dayOfMonth: number;
  completed: boolean;
  isToday: boolean;
}

export interface DailyStreakRewardEntry {
  id: string;
  amount: number;
  description: null | string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface DailyStreakDashboard {
  profileId: string;
  currentStreak: number;
  longestStreak: number;
  streakFreezes: number;
  lastActivityDate: null | string;
  claimedToday: boolean;
  todayRewardE1xp: number;
  totalStreakE1xp: number;
  nextMilestone: number;
  nextMilestoneRewardE1xp: number;
  last7Days: DailyStreakDay[];
  recentRewards: DailyStreakRewardEntry[];
}

export interface DailyStreakClaimResult {
  claimed: boolean;
  alreadyClaimed: boolean;
  activityDate: string;
  currentStreak: number;
  longestStreak: number;
  rewardE1xp: number;
  resetOccurred: boolean;
  milestoneReached: boolean;
  notificationId: null | string;
  dashboard: DailyStreakDashboard;
}

export interface Every1Mission {
  id: string;
  slug: string;
  title: string;
  description: null | string;
  status: "active" | "archived" | "completed" | "draft" | "paused";
  rewardE1xp: number;
  isRepeatable: boolean;
  taskType:
    | "comment"
    | "community_join"
    | "custom"
    | "launch_creator"
    | "like"
    | "payment"
    | "referral"
    | "share"
    | "streak_check_in";
  taskTitle: string;
  currentValue: number;
  targetValue: number;
  progressStatus:
    | "claimed"
    | "completed"
    | "expired"
    | "in_progress"
    | "not_started";
  completedAt: null | string;
  claimedAt: null | string;
  availableToClaim: boolean;
  percentComplete: number;
}

export interface MissionClaimResult {
  claimed: boolean;
  alreadyClaimed: boolean;
  missionId: string;
  missionTitle?: string;
  rewardE1xp?: number;
  reason?: string;
}

export interface ReferralDashboard {
  profile: null | ReferralDashboardProfile;
  referralCode: null | string;
  bonusPercent: number;
  stats: ReferralDashboardStats;
  recentReferrals: ReferralRecentEntry[];
  recentTradeRewards: ReferralTradeRewardEntry[];
  recentE1xp: E1xpLedgerEntry[];
}

export interface ReferralJoinResult {
  captured: boolean;
  e1xpAwarded?: number;
  reason?: string;
  eventId?: string;
  referrerId?: string;
  status?: string;
}

export interface ReferralRewardResult {
  rewardGranted: boolean;
  reason?: string;
  eventId?: string;
  tradeRewardId?: string;
  rewardAmount?: number;
  rewardPercent?: number;
  rewardSymbol?: string;
  e1xpAwarded?: number;
}

export type Every1MobileNavBadgeKey =
  | "creators_new_profiles"
  | "explore_new_coins"
  | "leaderboard_updates";

export interface Every1MobileNavBadgeCounts {
  creatorsCount: number;
  exploreCount: number;
  leaderboardCount: number;
}

export interface Every1MobileNavBadgeSeenResult {
  badgeKey: Every1MobileNavBadgeKey;
  lastSeenAt: string;
  profileId: string;
}

export interface Every1Notification {
  id: string;
  kind:
    | "comment"
    | "like"
    | "mission"
    | "payment"
    | "referral"
    | "reward"
    | "share"
    | "streak"
    | "system"
    | "toast";
  title: string;
  body: null | string;
  isRead: boolean;
  createdAt: string;
  targetKey: null | string;
  data: Record<string, unknown>;
  actorId: null | string;
  actorDisplayName: null | string;
  actorUsername: null | string;
  actorAvatarUrl: null | string;
}
