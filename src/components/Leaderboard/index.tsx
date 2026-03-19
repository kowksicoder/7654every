import {
  BellAlertIcon,
  CheckBadgeIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  FireIcon,
  FilmIcon,
  MapIcon,
  MusicalNoteIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Squares2X2Icon,
  TrophyIcon,
  UserGroupIcon
} from "@heroicons/react/24/solid";
import type { ComponentType, SVGProps } from "react";
import MetaTags from "@/components/Common/MetaTags";
import { Card } from "@/components/Shared/UI";
import cn from "@/helpers/cn";

type AvatarTone = "amber" | "emerald" | "rose" | "sky" | "slate" | "violet";
type DeskType = "Momentum" | "Options" | "Perps" | "Stocks" | "Swing";
type TrophyType = "Clutch" | "Hot" | "Legend" | "Signal" | "Vault";

interface LeaderboardEntry {
  alerts: string;
  averageGain: string;
  avatarTone: AvatarTone;
  desk: DeskType;
  featured?: boolean;
  handle: string;
  name: string;
  rank: number;
  streaks: number;
  trades: string;
  trophy: TrophyType;
  xscore: number;
}

const avatarTones: Record<AvatarTone, string> = {
  amber: "bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500",
  emerald: "bg-gradient-to-br from-emerald-200 via-emerald-400 to-green-600",
  rose: "bg-gradient-to-br from-rose-200 via-pink-400 to-rose-600",
  sky: "bg-gradient-to-br from-sky-200 via-sky-400 to-blue-600",
  slate: "bg-gradient-to-br from-slate-300 via-slate-500 to-slate-700",
  violet: "bg-gradient-to-br from-violet-200 via-violet-400 to-fuchsia-600"
};

const trophyStyles: Record<
  TrophyType,
  { className: string; icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  Clutch: {
    className:
      "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-900/70",
    icon: ShieldCheckIcon
  },
  Hot: {
    className:
      "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-900/70",
    icon: FireIcon
  },
  Legend: {
    className:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-900/70",
    icon: TrophyIcon
  },
  Signal: {
    className:
      "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-900/70",
    icon: BellAlertIcon
  },
  Vault: {
    className:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-900/70",
    icon: SparklesIcon
  }
};

const leaderboardEntries: LeaderboardEntry[] = [
  {
    alerts: "20 / 90%",
    averageGain: "90%",
    avatarTone: "amber",
    desk: "Options",
    featured: true,
    handle: "Day trader",
    name: "Roger Korsgaard",
    rank: 1,
    streaks: 14,
    trades: "497 / 90%",
    trophy: "Legend",
    xscore: 83
  },
  {
    alerts: "18 / 60%",
    averageGain: "90%",
    avatarTone: "rose",
    desk: "Stocks",
    featured: true,
    handle: "Swing trader",
    name: "Charlie Herwitz",
    rank: 2,
    streaks: 13,
    trades: "359 / 90%",
    trophy: "Clutch",
    xscore: 80
  },
  {
    alerts: "15 / 50%",
    averageGain: "90%",
    avatarTone: "slate",
    desk: "Options",
    featured: true,
    handle: "Short bias",
    name: "Ahmad Mango",
    rank: 3,
    streaks: 15,
    trades: "248 / 90%",
    trophy: "Legend",
    xscore: 75
  },
  {
    alerts: "20 / 90%",
    averageGain: "90%",
    avatarTone: "sky",
    desk: "Stocks",
    handle: "Swing trader",
    name: "Cristofer George",
    rank: 4,
    streaks: 5,
    trades: "497 / 90%",
    trophy: "Clutch",
    xscore: 66
  },
  {
    alerts: "20 / 90%",
    averageGain: "88%",
    avatarTone: "violet",
    desk: "Momentum",
    handle: "Scalp desk",
    name: "Naomi Vale",
    rank: 5,
    streaks: 17,
    trades: "442 / 86%",
    trophy: "Hot",
    xscore: 64
  },
  {
    alerts: "16 / 72%",
    averageGain: "84%",
    avatarTone: "emerald",
    desk: "Perps",
    handle: "Futures lead",
    name: "Reece Tanaka",
    rank: 6,
    streaks: 11,
    trades: "318 / 82%",
    trophy: "Signal",
    xscore: 59
  },
  {
    alerts: "19 / 88%",
    averageGain: "85%",
    avatarTone: "rose",
    desk: "Swing",
    handle: "Multi-week setups",
    name: "Talia Brooks",
    rank: 7,
    streaks: 8,
    trades: "281 / 80%",
    trophy: "Vault",
    xscore: 55
  },
  {
    alerts: "14 / 67%",
    averageGain: "79%",
    avatarTone: "amber",
    desk: "Momentum",
    handle: "Open bell focus",
    name: "Omar Ivers",
    rank: 8,
    streaks: 6,
    trades: "232 / 76%",
    trophy: "Hot",
    xscore: 51
  },
  {
    alerts: "12 / 63%",
    averageGain: "81%",
    avatarTone: "sky",
    desk: "Stocks",
    handle: "Macro watch",
    name: "Lena Park",
    rank: 9,
    streaks: 9,
    trades: "214 / 74%",
    trophy: "Clutch",
    xscore: 48
  }
];

const leaderboardFilters: Array<{
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  active?: boolean;
  label: string;
}> = [
  { Icon: Squares2X2Icon, active: true, label: "All" },
  { Icon: MusicalNoteIcon, label: "Music" },
  { Icon: PaintBrushIcon, label: "Art" },
  { Icon: FilmIcon, label: "Movies" },
  { Icon: SparklesIcon, label: "Pop-Culture" },
  { Icon: TrophyIcon, label: "Sports" },
  { Icon: MapIcon, label: "Travel" }
];

const parseCompactValue = (value: string) => {
  const normalized = value.replace(/[$,%\s]/g, "").trim().toLowerCase();
  const multiplier = normalized.endsWith("b")
    ? 1_000_000_000
    : normalized.endsWith("m")
      ? 1_000_000
      : normalized.endsWith("k")
        ? 1_000
        : 1;
  const base = Number.parseFloat(normalized.replace(/[bmk]$/i, ""));

  return Number.isNaN(base) ? 0 : base * multiplier;
};

const parsePrimaryMetric = (value: string) =>
  parseCompactValue(value.split("/")[0].trim());

const parsePercentage = (value: string) =>
  Number.parseFloat(value.replace("%", "").trim()) || 0;

const formatCompactValue = (
  value: number,
  { currency = false }: { currency?: boolean } = {}
) => {
  if (value === 0) {
    return currency ? "$0" : "0";
  }

  const absoluteValue = Math.abs(value);
  const [scaledValue, suffix] =
    absoluteValue >= 1_000_000_000
      ? [value / 1_000_000_000, "B"]
      : absoluteValue >= 1_000_000
        ? [value / 1_000_000, "M"]
        : absoluteValue >= 1_000
          ? [value / 1_000, "K"]
          : [value, ""];

  const decimals =
    Math.abs(scaledValue) >= 100 ? 0 : Math.abs(scaledValue) >= 10 ? 1 : 2;
  const formattedValue = scaledValue
    .toFixed(decimals)
    .replace(/\.0+$|(\.\d*[1-9])0+$/, "$1");

  return `${currency ? "$" : ""}${formattedValue}${suffix}`;
};

const longestStreak = Math.max(
  ...leaderboardEntries.map(({ streaks }) => streaks)
);
const totalTrades = leaderboardEntries.reduce(
  (sum, entry) => sum + parsePrimaryMetric(entry.trades),
  0
);
const averageGain =
  leaderboardEntries.reduce(
    (sum, entry) => sum + parsePercentage(entry.averageGain),
    0
  ) / leaderboardEntries.length;

const overviewCards = [
  {
    label: "Traders",
    value: leaderboardEntries.length.toString(),
    valueClassName: "text-[#26dd86]"
  },
  {
    label: "Avg Gain",
    value: `${averageGain.toFixed(1)}%`,
    valueClassName: "text-[#26dd86]"
  },
  {
    label: "Trades",
    value: formatCompactValue(totalTrades),
    valueClassName: "text-[#ffbf34]"
  },
  {
    label: "Longest Streak",
    value: `${longestStreak}d`,
    valueClassName: "text-white"
  }
];

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const RankBadge = ({
  compact = false,
  featured,
  rank
}: {
  compact?: boolean;
  featured?: boolean;
  rank: number;
}) => (
  <div
    className={cn(
      "flex shrink-0 items-center justify-center rounded-full font-semibold",
      compact ? "size-7 text-xs" : "size-8 text-sm",
      featured
        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-800/70"
        : "bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800"
    )}
  >
    {rank}
  </div>
);

const TrophyBadge = ({
  compact = false,
  trophy
}: {
  compact?: boolean;
  trophy: TrophyType;
}) => {
  const { className, icon: TrophyBadgeIcon } = trophyStyles[trophy];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        compact ? "gap-1 px-2 py-0.5 text-[10px]" : "gap-1.5 px-2.5 py-1 text-[11px]",
        className
      )}
    >
      <TrophyBadgeIcon className={compact ? "size-3" : "size-3.5"} />
      <span>{trophy}</span>
    </span>
  );
};

const OverviewCard = ({
  compact = false,
  label,
  value,
  valueClassName
}: {
  compact?: boolean;
  label: string;
  value: string;
  valueClassName: string;
}) => (
  <div
    className={cn(
      "shrink-0 rounded-[1.3rem] bg-[#171717] shadow-[0_18px_30px_-26px_rgba(0,0,0,0.95)]",
      compact ? "min-w-[6.5rem] px-3 py-2 text-center" : "min-w-[7.2rem] px-3 py-2.5"
    )}
  >
    <p
      className={cn(
        "font-semibold tracking-tight",
        compact ? "text-base" : "text-lg",
        valueClassName
      )}
    >
      {value}
    </p>
    <p
      className={cn(
        "font-medium text-[#a4a4a8]",
        compact ? "mt-0.5 text-[9px]" : "mt-0.5 text-[10px]"
      )}
    >
      {label}
    </p>
  </div>
);

const FilterChip = ({
  compact = false,
  Icon,
  active,
  label
}: {
  compact?: boolean;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  active?: boolean;
  label: string;
}) => (
  <button
    className={cn(
      "inline-flex shrink-0 items-center rounded-full font-semibold transition-colors",
      compact ? "gap-1.5 px-2.5 py-1.5 text-[12px]" : "gap-2 px-3 py-2 text-[13px]",
      active
        ? "bg-[#12c46b] text-white shadow-[0_16px_28px_-20px_rgba(18,196,107,0.95)]"
        : "border border-[#262628] bg-[#141415] text-[#9f9fa5]"
    )}
    type="button"
  >
    <Icon className={compact ? "size-3.5" : "size-4"} />
    <span>{label}</span>
  </button>
);

const MobileMetric = ({
  accent,
  label,
  value
}: {
  accent?: boolean;
  label: string;
  value: string;
}) => (
  <div className="min-w-0 rounded-2xl bg-[#101011] px-2.5 py-2">
    <p
      className={cn(
        "truncate text-[13px] font-semibold tracking-tight",
        accent ? "text-[#ffbf34]" : "text-white"
      )}
    >
      {value}
    </p>
    <p className="mt-1 text-[10px] font-medium text-[#8c8c92]">{label}</p>
  </div>
);

const MobileLeaderboardCard = ({
  entry
}: {
  entry: LeaderboardEntry;
}) => (
  <div
    className={cn(
      "rounded-[1.5rem] px-3.5 py-3 shadow-[0_22px_32px_-28px_rgba(0,0,0,0.98)]",
      entry.featured
        ? "bg-[#191611] ring-1 ring-[#59411d]/60"
        : "bg-[#171717] ring-1 ring-white/[0.03]"
    )}
  >
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center gap-2">
        <RankBadge compact featured={entry.featured} rank={entry.rank} />
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm ring-1 ring-black/10",
            avatarTones[entry.avatarTone]
          )}
        >
          {getInitials(entry.name)}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-[15px] font-semibold text-white">
              {entry.name}
            </p>
            <CheckBadgeIcon className="size-4 shrink-0 text-sky-400" />
          </div>
          <p className="truncate text-[11px] text-[#9f9fa5]">{entry.handle}</p>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <TrophyBadge compact trophy={entry.trophy} />
        </div>
      </div>
    </div>

    <div className="mt-3 grid grid-cols-3 gap-2">
      <MobileMetric label="Streaks" value={entry.streaks.toString()} />
      <MobileMetric
        label="Trades"
        value={entry.trades.split("/")[0].trim()}
      />
      <MobileMetric accent label="Avg" value={entry.averageGain} />
    </div>
  </div>
);

const LeaderboardRow = ({ entry }: { entry: LeaderboardEntry }) => {
  return (
    <Card
      className={cn(
        "mx-5 px-3.5 py-3 transition-all md:mx-0",
        entry.featured
          ? "border-amber-300 bg-amber-50/55 dark:border-amber-800/70 dark:bg-amber-500/5"
          : "hover:border-gray-300 hover:bg-gray-50/70 dark:hover:border-gray-600 dark:hover:bg-gray-950/60"
      )}
      forceRounded
    >
      <div className="grid items-center gap-3 md:grid-cols-[minmax(0,2.8fr)_0.9fr_0.6fr_0.95fr_0.75fr_4rem]">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <RankBadge featured={entry.featured} rank={entry.rank} />
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm ring-1 ring-black/5",
                avatarTones[entry.avatarTone]
              )}
            >
              {getInitials(entry.name)}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate text-[14px] font-semibold text-gray-950 dark:text-gray-50">
                  {entry.name}
                </p>
                <CheckBadgeIcon className="size-4 shrink-0 text-sky-500" />
              </div>
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                {entry.handle}
              </p>
            </div>
          </div>
        </div>

        <div>
          <TrophyBadge trophy={entry.trophy} />
        </div>

        <div className="text-center text-sm font-semibold text-gray-800 dark:text-gray-100">
          {entry.streaks}
        </div>

        <div className="text-center text-sm font-semibold text-gray-800 dark:text-gray-100">
          {entry.trades}
        </div>

        <div className="text-center text-sm font-semibold text-gray-800 dark:text-gray-100">
          {entry.averageGain}
        </div>

        <div className="flex items-center justify-end gap-1">
          <button
            aria-label={`More options for ${entry.name}`}
            className="flex size-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            type="button"
          >
            <EllipsisHorizontalIcon className="size-4" />
          </button>
          <button
            aria-label={`Open community for ${entry.name}`}
            className="flex size-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            type="button"
          >
            <UserGroupIcon className="size-3.5" />
          </button>
          <button
            aria-label={`Open ${entry.name}`}
            className="flex size-7 items-center justify-center rounded-full bg-white text-gray-500 transition-colors hover:text-gray-700 dark:bg-transparent dark:text-gray-400 dark:hover:text-gray-200"
            type="button"
          >
            <ChevronRightIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
};

const Leaderboard = () => {
  return (
    <>
      <MetaTags
        description="A leaderboard mockup for Every1 with compact ranking cards, overview stats, and desktop/mobile parity."
        title="Leaderboard"
      />
      <main className="mt-0 mb-16 min-w-0 flex-1 md:mt-5 md:mb-5">
        <section className="bg-[#0d0d0e] px-4 pb-8 pt-4 text-white md:hidden">
          <div className="space-y-4">
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {overviewCards.map((card) => (
                <OverviewCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  valueClassName={card.valueClassName}
                />
              ))}
            </div>

            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {leaderboardFilters.map((filter) => (
                <FilterChip
                  Icon={filter.Icon}
                  active={filter.active}
                  key={filter.label}
                  label={filter.label}
                />
              ))}
            </div>

            <div className="space-y-2.5">
              {leaderboardEntries.map((entry) => (
                <MobileLeaderboardCard entry={entry} key={entry.rank} />
              ))}
            </div>
          </div>
        </section>

        <section className="hidden space-y-3.5 md:block">
          <div className="flex justify-center">
            <div className="no-scrollbar flex flex-wrap justify-center gap-2.5 pb-1">
              {overviewCards.map((card) => (
                <OverviewCard
                  compact
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  valueClassName={card.valueClassName}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <div className="no-scrollbar flex flex-wrap justify-center gap-2 pb-1">
              {leaderboardFilters.map((filter) => (
                <FilterChip
                  Icon={filter.Icon}
                  active={filter.active}
                  compact
                  key={filter.label}
                  label={filter.label}
                />
              ))}
            </div>
          </div>

          <div className="hidden px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500 md:grid md:grid-cols-[minmax(0,2.8fr)_0.9fr_0.6fr_0.95fr_0.75fr_4rem] md:items-center">
            <span>Name</span>
            <span>Trophy</span>
            <span className="text-center">Streaks</span>
            <span className="text-center">Trades</span>
            <span className="text-center">Avg</span>
            <span />
          </div>

          <section className="space-y-2.5 pb-6">
            {leaderboardEntries.map((entry) => (
              <LeaderboardRow entry={entry} key={entry.rank} />
            ))}
          </section>
        </section>
      </main>
    </>
  );
};

export default Leaderboard;
