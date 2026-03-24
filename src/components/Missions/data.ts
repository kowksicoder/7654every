import type { Every1FanDropCampaign } from "@/types/every1";

export type FanDropCardState = "completed" | "ended" | "joined" | "live";

export interface FanDropTask {
  label: string;
  progressLabel?: string;
  state: "complete" | "optional" | "todo";
}

export interface FanDropCampaign {
  about: string;
  accentClassName: string;
  bannerImageUrl: string;
  coverLabel: string;
  creatorHandle: string;
  creatorName: string;
  ctaLabel: string;
  id: string;
  progressComplete: number;
  progressTotal: number;
  rankLabel: string;
  rewardPoolLabel: string;
  slug: string;
  state: FanDropCardState;
  subtitle: string;
  tasks: FanDropTask[];
  timeLabel: string;
  title: string;
}

const STATIC_FANDROP_VISUALS: FanDropCampaign[] = [
  {
    about:
      "Asake is opening an early fan run for his next drop. Join the circle, bring your people, and lock in your spot before rewards settle.",
    accentClassName:
      "bg-gradient-to-br from-emerald-300 via-lime-200 to-yellow-100 dark:from-emerald-500/30 dark:via-lime-500/15 dark:to-yellow-500/10",
    bannerImageUrl: "/buycoin.png",
    coverLabel: "Street pop",
    creatorHandle: "@asakemusic",
    creatorName: "Asake",
    ctaLabel: "Join FanDrop",
    id: "fd_asake_live",
    progressComplete: 1,
    progressTotal: 3,
    rankLabel: "#23",
    rewardPoolLabel: "5,000 ASAKE",
    slug: "asake-fandrop",
    state: "live",
    subtitle: "Earn rewards before the drop lands.",
    tasks: [
      { label: "Join", state: "complete" },
      { label: "Invite 2 friends", state: "todo" },
      { label: "Buy N500 (optional)", state: "optional" }
    ],
    timeLabel: "12h",
    title: "Asake FanDrop"
  },
  {
    about:
      "Ayra's core fan circle is running a referral sprint. Bring in new supporters, finish the final step, and climb the reward board before close.",
    accentClassName:
      "bg-gradient-to-br from-cyan-200 via-sky-100 to-indigo-100 dark:from-cyan-500/20 dark:via-sky-500/10 dark:to-indigo-500/10",
    bannerImageUrl: "/buycoin.png",
    coverLabel: "Core fans",
    creatorHandle: "@ayrastarr",
    creatorName: "Ayra Starr",
    ctaLabel: "Invite Friends",
    id: "fd_ayra_joined",
    progressComplete: 2,
    progressTotal: 3,
    rankLabel: "#15",
    rewardPoolLabel: "3,200 AYRA",
    slug: "ayra-circle-sprint",
    state: "joined",
    subtitle: "You are in. Push one more step for bonus rewards.",
    tasks: [
      { label: "Join", state: "complete" },
      { label: "Invite friends", progressLabel: "1/2", state: "complete" },
      { label: "Buy N500 (optional)", state: "optional" }
    ],
    timeLabel: "10h",
    title: "Ayra Circle Sprint"
  },
  {
    about:
      "Burna's drop queue is almost settled. You already cleared the actions, so this page becomes your holding screen until distribution completes.",
    accentClassName:
      "bg-gradient-to-br from-amber-200 via-orange-100 to-rose-100 dark:from-amber-500/20 dark:via-orange-500/12 dark:to-rose-500/10",
    bannerImageUrl: "/buycoin.png",
    coverLabel: "Reward queue",
    creatorHandle: "@burnaboy",
    creatorName: "Burna Boy",
    ctaLabel: "Completed",
    id: "fd_burna_completed",
    progressComplete: 3,
    progressTotal: 3,
    rankLabel: "#8",
    rewardPoolLabel: "8,000 BURNA",
    slug: "burna-reward-wave",
    state: "completed",
    subtitle: "Rewards are pending while the pool settles.",
    tasks: [
      { label: "Join", state: "complete" },
      { label: "Invite 2 friends", state: "complete" },
      { label: "Buy N500", state: "complete" }
    ],
    timeLabel: "4h",
    title: "Burna Reward Wave"
  },
  {
    about:
      "UNILAG Creators ran a campus FanDrop for members who showed up early, invited builders, and supported the coin before the window closed.",
    accentClassName:
      "bg-gradient-to-br from-fuchsia-200 via-pink-100 to-orange-100 dark:from-fuchsia-500/18 dark:via-pink-500/12 dark:to-orange-500/10",
    bannerImageUrl: "/buycoin.png",
    coverLabel: "Campus",
    creatorHandle: "@unilagcreators",
    creatorName: "UNILAG Creators",
    ctaLabel: "View Results",
    id: "fd_unilag_ended",
    progressComplete: 3,
    progressTotal: 3,
    rankLabel: "#12",
    rewardPoolLabel: "2,400 UNILAG",
    slug: "unilag-campus-rally",
    state: "ended",
    subtitle: "The campaign ended and final results are now locked.",
    tasks: [
      { label: "Join", state: "complete" },
      { label: "Invite 2 friends", state: "complete" },
      { label: "Buy N500", state: "complete" }
    ],
    timeLabel: "Ended",
    title: "UNILAG Campus Rally"
  },
  {
    about:
      "A fast-moving creators-only FanDrop aimed at culture accounts, meme pages, and trend spotters who move early and keep engagement hot.",
    accentClassName:
      "bg-gradient-to-br from-lime-200 via-emerald-100 to-cyan-100 dark:from-lime-500/18 dark:via-emerald-500/12 dark:to-cyan-500/10",
    bannerImageUrl: "/buycoin.png",
    coverLabel: "Culture",
    creatorHandle: "@cultureplug",
    creatorName: "Culture Plug",
    ctaLabel: "Complete Now",
    id: "fd_culture_live",
    progressComplete: 2,
    progressTotal: 3,
    rankLabel: "#19",
    rewardPoolLabel: "4,500 PLUG",
    slug: "culture-plug-rush",
    state: "joined",
    subtitle: "One final action stands between you and the payout lane.",
    tasks: [
      { label: "Join", state: "complete" },
      { label: "Invite 2 friends", state: "complete" },
      { label: "Buy N500", state: "todo" }
    ],
    timeLabel: "6h",
    title: "Culture Plug Rush"
  },
  {
    about:
      "A creator-week FanDrop spotlight for fans who enter early, invite their circle, and stay ready before the final leaderboard lock.",
    accentClassName:
      "bg-gradient-to-br from-violet-200 via-indigo-100 to-cyan-100 dark:from-violet-500/20 dark:via-indigo-500/12 dark:to-cyan-500/10",
    bannerImageUrl: "/buycoin.png",
    coverLabel: "Spotlight",
    creatorHandle: "@jessepollak",
    creatorName: "Jesse Pollak",
    ctaLabel: "Join FanDrop",
    id: "fd_jesse_live",
    progressComplete: 0,
    progressTotal: 3,
    rankLabel: "#41",
    rewardPoolLabel: "6,000 BASE",
    slug: "creator-week-spotlight",
    state: "live",
    subtitle: "Step in early and fight for a higher FanDrop rank.",
    tasks: [
      { label: "Join", state: "todo" },
      { label: "Invite 2 friends", state: "todo" },
      { label: "Buy N500 (optional)", state: "optional" }
    ],
    timeLabel: "18h",
    title: "Creator Week Spotlight"
  }
];

const FALLBACK_VISUAL: Pick<
  FanDropCampaign,
  "accentClassName" | "bannerImageUrl" | "coverLabel"
> = {
  accentClassName:
    "bg-gradient-to-br from-gray-200 via-gray-100 to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-black",
  bannerImageUrl: "/buycoin.png",
  coverLabel: "FanDrop"
};

const FAN_DROP_VISUALS_BY_SLUG = new Map(
  STATIC_FANDROP_VISUALS.map((campaign) => [campaign.slug, campaign])
);

const formatTimeLabel = (state: FanDropCardState, endsAt?: null | string) => {
  if (state === "ended") {
    return "Ended";
  }

  if (!endsAt) {
    return "Live";
  }

  const diffMs = new Date(endsAt).getTime() - Date.now();

  if (diffMs <= 0) {
    return "Ended";
  }

  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) {
    return `${Math.max(1, Math.ceil(diffHours))}h`;
  }

  return `${Math.max(1, Math.ceil(diffHours / 24))}d`;
};

export const getFanDropVisualBySlug = (slug?: string | null) =>
  (slug ? FAN_DROP_VISUALS_BY_SLUG.get(slug) : null) || null;

export const getStaticFanDropFallbackBySlug = (slug?: string | null) =>
  (slug ? FAN_DROP_VISUALS_BY_SLUG.get(slug) : null) || null;

export const mapEvery1FanDropToCard = (
  campaign: Every1FanDropCampaign
): FanDropCampaign => {
  const visual = getFanDropVisualBySlug(campaign.slug);

  return {
    about: campaign.about || visual?.about || "",
    accentClassName: visual?.accentClassName || FALLBACK_VISUAL.accentClassName,
    bannerImageUrl:
      campaign.bannerUrl ||
      visual?.bannerImageUrl ||
      FALLBACK_VISUAL.bannerImageUrl,
    coverLabel:
      campaign.coverLabel || visual?.coverLabel || FALLBACK_VISUAL.coverLabel,
    creatorHandle: campaign.creatorHandle || visual?.creatorHandle || "@every1",
    creatorName: campaign.creatorName || visual?.creatorName || "Every1",
    ctaLabel: campaign.ctaLabel,
    id: campaign.id,
    progressComplete: campaign.progressComplete,
    progressTotal: campaign.progressTotal,
    rankLabel: campaign.rankLabel,
    rewardPoolLabel:
      campaign.rewardPoolLabel || visual?.rewardPoolLabel || "Reward pool live",
    slug: campaign.slug,
    state: campaign.state,
    subtitle: campaign.subtitle || visual?.subtitle || "Rewards are live now.",
    tasks: campaign.tasks.map((task) => ({
      label: task.label,
      progressLabel: task.progressLabel || undefined,
      state: task.state
    })),
    timeLabel:
      campaign.timeLabel || formatTimeLabel(campaign.state, campaign.endsAt),
    title: campaign.title
  };
};

export const STATIC_FANDROP_FALLBACK_CAMPAIGNS = STATIC_FANDROP_VISUALS;
