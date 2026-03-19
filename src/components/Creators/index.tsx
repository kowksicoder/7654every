import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon
} from "@heroicons/react/24/solid";
import MetaTags from "@/components/Common/MetaTags";
import { Card } from "@/components/Shared/UI";
import cn from "@/helpers/cn";

type Tone =
  | "amber"
  | "aqua"
  | "blue"
  | "emerald"
  | "fuchsia"
  | "indigo"
  | "orange"
  | "rose"
  | "sky"
  | "slate"
  | "teal"
  | "violet";

type Trend = "down" | "up";

interface PreviewAsset {
  label: string;
  tone: Tone;
}

interface CreatorEntry {
  age: string;
  avatarTone: Tone;
  handle: string;
  marketCap: string;
  name: string;
  previews: PreviewAsset[];
  sparkline: number[];
  trend: Trend;
  volume: string;
}

const toneClasses: Record<Tone, string> = {
  amber: "bg-gradient-to-br from-amber-200 via-yellow-400 to-orange-500",
  aqua: "bg-gradient-to-br from-cyan-200 via-sky-400 to-blue-500",
  blue: "bg-gradient-to-br from-blue-300 via-blue-500 to-indigo-600",
  emerald: "bg-gradient-to-br from-emerald-200 via-emerald-400 to-green-600",
  fuchsia: "bg-gradient-to-br from-pink-200 via-fuchsia-400 to-fuchsia-600",
  indigo: "bg-gradient-to-br from-indigo-200 via-indigo-500 to-violet-700",
  orange: "bg-gradient-to-br from-orange-200 via-orange-400 to-red-500",
  rose: "bg-gradient-to-br from-rose-200 via-pink-400 to-rose-600",
  sky: "bg-gradient-to-br from-sky-200 via-sky-400 to-cyan-600",
  slate: "bg-gradient-to-br from-slate-300 via-slate-500 to-slate-700",
  teal: "bg-gradient-to-br from-teal-200 via-teal-400 to-emerald-600",
  violet: "bg-gradient-to-br from-violet-200 via-violet-400 to-fuchsia-600"
};

const mockCreators: CreatorEntry[] = [
  {
    age: "3mo",
    avatarTone: "slate",
    handle: "@thenickshirley",
    marketCap: "$395k",
    name: "thenickshirley",
    previews: [
      { label: "IRL", tone: "slate" },
      { label: "CAR", tone: "orange" },
      { label: "CAM", tone: "sky" }
    ],
    sparkline: [92, 78, 74, 66, 64, 69, 71, 83, 86, 90, 98, 88, 91],
    trend: "up",
    volume: "$179k"
  },
  {
    age: "9mo",
    avatarTone: "orange",
    handle: "@sfascinated",
    marketCap: "$39k",
    name: "fascinated",
    previews: [
      { label: "ARC", tone: "slate" },
      { label: "UI", tone: "rose" },
      { label: "DOC", tone: "slate" }
    ],
    sparkline: [20, 21, 22, 23, 19, 18, 54, 71, 76, 78, 78, 72, 80],
    trend: "up",
    volume: "$2k"
  },
  {
    age: "7mo",
    avatarTone: "sky",
    handle: "@thebeastfs",
    marketCap: "$46k",
    name: "thebeast",
    previews: [
      { label: "UNI", tone: "blue" },
      { label: "TRB", tone: "rose" },
      { label: "PCE", tone: "amber" }
    ],
    sparkline: [44, 43, 31, 28, 57, 54, 71, 78, 80, 96, 89, 88, 87],
    trend: "up",
    volume: "$9k"
  },
  {
    age: "6mo",
    avatarTone: "emerald",
    handle: "@skeetermcbeaver",
    marketCap: "$2k",
    name: "SkeeterMcbeaver",
    previews: [
      { label: "MIX", tone: "amber" },
      { label: "RAW", tone: "slate" },
      { label: "CUT", tone: "orange" }
    ],
    sparkline: [92, 41, 13, 12, 12, 13, 14, 17, 20, 17, 14, 13, 12],
    trend: "down",
    volume: "$822"
  },
  {
    age: "8mo",
    avatarTone: "slate",
    handle: "@balajis",
    marketCap: "$618k",
    name: "Balaji",
    previews: [
      { label: "MAP", tone: "slate" },
      { label: "THS", tone: "sky" },
      { label: "MEM", tone: "slate" }
    ],
    sparkline: [90, 75, 62, 60, 52, 55, 48, 58, 56, 60, 52, 54, 51],
    trend: "down",
    volume: "$4k"
  },
  {
    age: "2mo",
    avatarTone: "sky",
    handle: "@marketscoin",
    marketCap: "$71k",
    name: "MC",
    previews: [
      { label: "AOR", tone: "amber" },
      { label: "DEF", tone: "rose" },
      { label: "GLD", tone: "orange" }
    ],
    sparkline: [31, 30, 26, 18, 68, 67, 66, 66, 66, 67, 84, 85, 86],
    trend: "up",
    volume: "$2k"
  },
  {
    age: "5mo",
    avatarTone: "slate",
    handle: "@cc0company",
    marketCap: "$17k",
    name: "CC0 COMPANY",
    previews: [
      { label: "FLM", tone: "orange" },
      { label: "ORB", tone: "indigo" },
      { label: "BLK", tone: "slate" }
    ],
    sparkline: [82, 58, 44, 37, 34, 33, 11, 11, 29, 21, 22, 21, 21],
    trend: "down",
    volume: "$1k"
  },
  {
    age: "3mo",
    avatarTone: "amber",
    handle: "@dexcheckai",
    marketCap: "$387k",
    name: "dexcheckai",
    previews: [
      { label: "DCT", tone: "amber" },
      { label: "GMZ", tone: "slate" },
      { label: "SGN", tone: "blue" }
    ],
    sparkline: [28, 71, 37, 43, 39, 94, 23, 25, 88, 30, 35, 33, 34],
    trend: "up",
    volume: "$38k"
  },
  {
    age: "13d",
    avatarTone: "teal",
    handle: "@ugorreser",
    marketCap: "$108k",
    name: "UGORRESER",
    previews: [
      { label: "SUN", tone: "amber" },
      { label: "SIG", tone: "slate" },
      { label: "GLD", tone: "orange" }
    ],
    sparkline: [86, 86, 88, 91, 73, 79, 58, 62, 54, 56, 57, 54, 49],
    trend: "down",
    volume: "$83k"
  },
  {
    age: "4mo",
    avatarTone: "sky",
    handle: "@jessepollak",
    marketCap: "$1.9m",
    name: "Jesse Pollak",
    previews: [
      { label: "PK", tone: "slate" },
      { label: "NOTE", tone: "sky" },
      { label: "MEM", tone: "slate" }
    ],
    sparkline: [91, 91, 91, 91, 69, 66, 58, 60, 54, 49, 42, 36, 30],
    trend: "down",
    volume: "$8k"
  },
  {
    age: "4mo",
    avatarTone: "slate",
    handle: "@ugol",
    marketCap: "$8k",
    name: "Simon Schneider",
    previews: [
      { label: "MON", tone: "slate" },
      { label: "LOOP", tone: "indigo" },
      { label: "SND", tone: "sky" }
    ],
    sparkline: [84, 72, 59, 44, 21, 18, 63, 98, 100, 70, 66, 66, 69],
    trend: "down",
    volume: "$1k"
  },
  {
    age: "2mo",
    avatarTone: "aqua",
    handle: "@topbasetrending",
    marketCap: "$46k",
    name: "Top Base Trending",
    previews: [
      { label: "BX", tone: "slate" },
      { label: "OLD", tone: "orange" },
      { label: "BSE", tone: "slate" }
    ],
    sparkline: [93, 91, 14, 14, 71, 40, 39, 43, 34, 34, 32, 31, 31],
    trend: "down",
    volume: "$577"
  },
  {
    age: "8mo",
    avatarTone: "blue",
    handle: "@bouhiron",
    marketCap: "$64k",
    name: "BHRN FR",
    previews: [
      { label: "BHR", tone: "slate" },
      { label: "FR", tone: "slate" },
      { label: "XRP", tone: "blue" }
    ],
    sparkline: [88, 69, 43, 14, 14, 14, 31, 14, 14, 27, 22, 20, 19],
    trend: "down",
    volume: "$2k"
  },
  {
    age: "5mo",
    avatarTone: "indigo",
    handle: "@8bitbase",
    marketCap: "$37k",
    name: "8BITBASE",
    previews: [
      { label: "GM", tone: "slate" },
      { label: "8B", tone: "emerald" },
      { label: "LMN", tone: "amber" }
    ],
    sparkline: [72, 67, 53, 52, 21, 35, 40, 17, 66, 79, 76, 82, 74],
    trend: "up",
    volume: "$4k"
  },
  {
    age: "4mo",
    avatarTone: "sky",
    handle: "@princeofcoins",
    marketCap: "$9k",
    name: "Princeofcoins",
    previews: [
      { label: "MAP", tone: "slate" },
      { label: "BUY", tone: "fuchsia" },
      { label: "ASK", tone: "sky" }
    ],
    sparkline: [74, 31, 28, 36, 26, 26, 26, 41, 42, 33, 14, 15, 16],
    trend: "down",
    volume: "$560"
  },
  {
    age: "5mo",
    avatarTone: "fuchsia",
    handle: "@bearmarketcoin",
    marketCap: "$85k",
    name: "BEAR MARKET COIN",
    previews: [
      { label: "BM", tone: "fuchsia" },
      { label: "DOG", tone: "amber" },
      { label: "BEAR", tone: "orange" }
    ],
    sparkline: [37, 37, 41, 42, 21, 82, 73, 96, 99, 100, 86, 86, 88],
    trend: "up",
    volume: "$1k"
  },
  {
    age: "6mo",
    avatarTone: "amber",
    handle: "@kkn",
    marketCap: "$1k",
    name: "KidKoin",
    previews: [
      { label: "KK", tone: "slate" },
      { label: "CO", tone: "amber" },
      { label: "JP", tone: "slate" }
    ],
    sparkline: [84, 97, 84, 82, 79, 29, 18, 18, 21, 21, 21, 21, 16],
    trend: "down",
    volume: "$9k"
  },
  {
    age: "9mo",
    avatarTone: "teal",
    handle: "@hojak",
    marketCap: "$74k",
    name: "hojak",
    previews: [
      { label: "XRP", tone: "indigo" },
      { label: "MEM", tone: "slate" },
      { label: "LTR", tone: "amber" }
    ],
    sparkline: [84, 82, 83, 75, 73, 14, 11, 11, 34, 36, 18, 19, 18],
    trend: "down",
    volume: "$4k"
  },
  {
    age: "18d",
    avatarTone: "rose",
    handle: "@papoy",
    marketCap: "$38k",
    name: "papoy",
    previews: [
      { label: "UX", tone: "amber" },
      { label: "ARC", tone: "orange" },
      { label: "PM", tone: "blue" }
    ],
    sparkline: [64, 66, 58, 52, 11, 11, 79, 90, 84, 90, 88, 85, 69],
    trend: "up",
    volume: "$614"
  },
  {
    age: "2mo",
    avatarTone: "slate",
    handle: "@aeongems",
    marketCap: "$34k",
    name: "aeongems",
    previews: [
      { label: "AE", tone: "emerald" },
      { label: "ORB", tone: "amber" },
      { label: "DOG", tone: "orange" }
    ],
    sparkline: [85, 68, 54, 39, 19, 11, 18, 13, 11, 11, 12, 11, 19],
    trend: "down",
    volume: "$2k"
  }
];

const statPills = [
  `${mockCreators.length} mock creators`,
  "Desktop leaderboard",
  "Zora sync next"
];

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatId = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();

const buildSparkline = (values: number[]) => {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100;
    const y = 34 - ((value - min) / range) * 26;

    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const;
  });

  const linePath = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");

  return {
    areaPath: `${linePath} L 100 40 L 0 40 Z`,
    lastPoint: points[points.length - 1],
    linePath
  };
};

const Sparkline = ({
  handle,
  trend,
  values
}: {
  handle: string;
  trend: Trend;
  values: number[];
}) => {
  const chartId = formatId(handle);
  const { areaPath, lastPoint, linePath } = buildSparkline(values);
  const strokeColor = trend === "up" ? "#22c55e" : "#d946ef";
  const softColor = trend === "up" ? "#86efac" : "#f5d0fe";

  return (
    <svg
      aria-hidden="true"
      className="h-14 w-full min-w-[8rem]"
      preserveAspectRatio="none"
      viewBox="0 0 100 40"
    >
      <defs>
        <linearGradient id={`${chartId}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={softColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={softColor} stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${chartId}-fill)`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
      <circle
        cx={lastPoint[0]}
        cy={lastPoint[1]}
        fill={strokeColor}
        r="2.8"
        stroke="white"
        strokeWidth="1.5"
      />
    </svg>
  );
};

const PreviewStrip = ({ previews }: { previews: PreviewAsset[] }) => (
  <div className="flex items-center -space-x-2">
    {previews.map((preview) => (
      <div
        className={cn(
          "flex size-11 items-center justify-center overflow-hidden rounded-xl border border-white text-[9px] font-semibold tracking-[0.2em] text-white shadow-sm dark:border-gray-950",
          toneClasses[preview.tone]
        )}
        key={`${preview.label}-${preview.tone}`}
      >
        {preview.label.slice(0, 4)}
      </div>
    ))}
  </div>
);

const TrendValue = ({
  trend,
  value
}: {
  trend: Trend;
  value: string;
}) => {
  const isUp = trend === "up";
  const TrendIcon = isUp ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-base font-semibold md:text-[1.05rem]",
        isUp ? "text-emerald-500" : "text-fuchsia-500"
      )}
    >
      <TrendIcon className="size-4" />
      <span>{value}</span>
    </div>
  );
};

const CreatorRow = ({ creator }: { creator: CreatorEntry }) => (
  <Card
    className="mx-5 px-4 py-4 transition-colors hover:border-gray-300 hover:bg-gray-50/60 dark:hover:border-gray-600 dark:hover:bg-gray-950/60 md:mx-0 md:px-5"
    forceRounded
  >
    <div className="grid gap-4 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:items-center">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm ring-1 ring-black/5",
            toneClasses[creator.avatarTone]
          )}
        >
          {getInitials(creator.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-gray-950 dark:text-gray-50">
            {creator.name}
          </p>
          <p className="truncate text-base text-gray-500 dark:text-gray-400">
            {creator.handle}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 md:hidden">
          Market cap
        </p>
        <TrendValue trend={creator.trend} value={creator.marketCap} />
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 md:hidden">
          24h vol
        </p>
        <p className="text-base font-semibold text-gray-950 dark:text-gray-50">
          {creator.volume}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 md:hidden">
          Age
        </p>
        <p className="text-base text-gray-500 dark:text-gray-400">
          {creator.age}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 md:hidden">
          Recent drops
        </p>
        <PreviewStrip previews={creator.previews} />
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 md:hidden">
          Past 24 hours
        </p>
        <Sparkline
          handle={creator.handle}
          trend={creator.trend}
          values={creator.sparkline}
        />
      </div>
    </div>
  </Card>
);

const Creators = () => {
  return (
    <>
      <MetaTags
        description="A creator leaderboard mockup for Every1. Static data for now, with Zora integration coming later."
        title="Creators"
      />
      <main className="mt-5 mb-16 min-w-0 flex-1 space-y-4 md:mb-5">
        <Card
          className="relative mx-5 overflow-hidden px-5 py-6 md:mx-0 md:px-6"
          forceRounded
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-400/0 via-emerald-400/80 to-fuchsia-500/0" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gray-500">
                Creator coins
              </p>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold text-gray-950 dark:text-gray-50">
                  Creators
                </h1>
                <p className="max-w-xl text-sm text-gray-600 dark:text-gray-400">
                  A clean first pass for the creator board. It is static for now
                  and ready for us to wire into Zora data next.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {statPills.map((pill) => (
                <span
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  key={pill}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <div className="hidden px-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:items-center md:px-5">
          <span>Coin</span>
          <span>Market cap</span>
          <span>24h vol</span>
          <span>Age</span>
          <span>Recent drops</span>
          <span>Past 24 hours</span>
        </div>

        <section className="space-y-3 pb-6">
          {mockCreators.map((creator) => (
            <CreatorRow creator={creator} key={creator.handle} />
          ))}
        </section>
      </main>
    </>
  );
};

export default Creators;
