/** biome-ignore-all lint/a11y/noSvgWithoutTitle: <explanation> */
import { ArrowsRightLeftIcon, CogIcon } from "@heroicons/react/24/solid";
import { useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/Shared/PageLayout";
import { Button, Card, Input } from "@/components/Shared/UI";

type Coin = {
  name: string;
  symbol: string;
  priceNgn: number;
  percentChange: number;
  volume: number;
  holders: number;
  balanceNgn: number;
  balanceToken: number;
  avatarUrl: string;
};

const coins: Coin[] = [
  {
    avatarUrl: "https://i.pravatar.cc/100?u=wiz",
    balanceNgn: 2500,
    balanceToken: 30,
    holders: 450,
    name: "WizCoin",
    percentChange: 4.2,
    priceNgn: 85,
    symbol: "WIZ",
    volume: 210000
  },
  {
    avatarUrl: "https://i.pravatar.cc/100?u=funmi",
    balanceNgn: 4300,
    balanceToken: 18,
    holders: 310,
    name: "FunmiCoin",
    percentChange: -1.8,
    priceNgn: 120,
    symbol: "FUN",
    volume: 320000
  },
  {
    avatarUrl: "https://i.pravatar.cc/100?u=yemi",
    balanceNgn: 2900,
    balanceToken: 26,
    holders: 520,
    name: "YemiCoin",
    percentChange: 3.5,
    priceNgn: 72,
    symbol: "YEM",
    volume: 185000
  },
  {
    avatarUrl: "https://i.pravatar.cc/100?u=aya",
    balanceNgn: 3150,
    balanceToken: 22,
    holders: 380,
    name: "AyaCoin",
    percentChange: 1.2,
    priceNgn: 95,
    symbol: "AYA",
    volume: 154000
  },
  {
    avatarUrl: "https://i.pravatar.cc/100?u=nexa",
    balanceNgn: 2100,
    balanceToken: 14,
    holders: 260,
    name: "NexaCoin",
    percentChange: -0.9,
    priceNgn: 68,
    symbol: "NEX",
    volume: 112000
  }
];

type ChartPoint = { x: number; y: number };

const generateChartData = (
  basePrice: number,
  volume: number,
  phase: number
): { points: ChartPoint[]; polyline: string } => {
  const points: ChartPoint[] = [];
  const maxY = 50;
  const minY = 10;
  const priceMultiplier = Math.max(0.8, Math.min(1.3, volume / 5000));

  for (let i = 0; i < 8; i++) {
    const x = i * 25;
    const baseVariation = Math.sin(i * 0.7 + priceMultiplier + phase) * 8;
    const volumeVariation = (volume / 10000) * 5;
    const y =
      maxY - (maxY - minY) * (0.5 + baseVariation / 20 + volumeVariation / 10);
    points.push({ x, y: Math.max(minY, Math.min(maxY, y)) });
  }

  return {
    points,
    polyline: points.map((p) => `${p.x},${p.y}`).join(" ")
  };
};

const Swap = () => {
  const [fromFiat, setFromFiat] = useState("1000");
  const [toToken, setToToken] = useState("11.76");
  const [direction, setDirection] = useState<"fiatToToken" | "tokenToFiat">(
    "fiatToToken"
  );
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    let frame: number;
    const tick = () => {
      setPhase((p) => (p + 0.03) % (Math.PI * 2));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const [selectedCoin, setSelectedCoin] = useState<Coin>(coins[0]);
  const parsedFiat = Number(fromFiat);

  const computed = useMemo(() => {
    if (!Number.isFinite(parsedFiat) || parsedFiat < 0) {
      return { fiat: "0", token: "0.00" };
    }
    if (direction === "fiatToToken") {
      const tokenCalc = parsedFiat / selectedCoin.priceNgn;
      return {
        fiat: parsedFiat.toLocaleString("en-NG"),
        token: tokenCalc.toFixed(2)
      };
    }
    const parsedToken = Number(toToken);
    if (!Number.isFinite(parsedToken) || parsedToken < 0)
      return { fiat: "0", token: "0.00" };
    const fiatCalc = parsedToken * selectedCoin.priceNgn;
    return {
      fiat: fiatCalc.toLocaleString("en-NG"),
      token: parsedToken.toFixed(2)
    };
  }, [direction, parsedFiat, toToken, selectedCoin]);

  // Generate interactive chart points based on current price
  const chartData = useMemo(() => {
    const currentPrice =
      direction === "fiatToToken"
        ? parsedFiat
        : Number(toToken) * selectedCoin.priceNgn;
    return generateChartData(selectedCoin.priceNgn, currentPrice, phase);
  }, [direction, parsedFiat, toToken, phase, selectedCoin]);

  const [hover, setHover] = useState<null | {
    x: number;
    y: number;
    value: number;
  }>(null);

  const handleChartMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clampedX = Math.max(0, Math.min(rect.width, x));

    // Find nearest point to hovered X
    const nearest = chartData.points.reduce((prev, point) => {
      const prevDiff = Math.abs(prev.x - (clampedX / rect.width) * 200);
      const currDiff = Math.abs(point.x - (clampedX / rect.width) * 200);
      return currDiff < prevDiff ? point : prev;
    }, chartData.points[0]);

    // Convert y back to a pseudo-price for display
    const priceFromY = Math.round(coin.priceNgn + (50 - nearest.y) * 0.35);

    setHover({
      value: priceFromY,
      x: (nearest.x / 200) * rect.width,
      y: (nearest.y / 50) * rect.height
    });
  };

  const handleChartMouseLeave = () => setHover(null);

  const handleSwapPress = () => {
    if (direction === "fiatToToken") {
      setToToken(computed.token);
    } else {
      setFromFiat(computed.fiat.replace(/,/g, ""));
    }
  };

  const tokenOutput = direction === "fiatToToken" ? computed.token : toToken;
  const fiatOutput = direction === "fiatToToken" ? fromFiat : computed.fiat;

  return (
    <PageLayout description="A self-serve swap page for AyoCoin." title="Swap">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-3 md:gap-3 md:px-0">
        {/* Coin Header Card */}
        <Card className="overflow-hidden p-3 md:p-4" forceRounded>
          <div className="flex items-center justify-between gap-2 md:gap-3">
            {/* Coin Info - Left */}
            <div className="flex flex-shrink-0 items-center gap-2">
              <img
                alt={selectedCoin.name}
                className="h-10 w-10 rounded-full border border-gray-200 object-cover"
                src={selectedCoin.avatarUrl}
              />
              <div>
                <p className="font-bold text-base text-gray-900 dark:text-gray-100">
                  #{selectedCoin.symbol}
                </p>
                <p className="text-gray-500 text-xs">{selectedCoin.name}</p>
              </div>
            </div>

            {/* Chart - Middle */}
            <div className="h-14 w-24 flex-1">
              <svg
                className="h-full w-full cursor-crosshair"
                onMouseLeave={handleChartMouseLeave}
                onMouseMove={handleChartMouseMove}
                viewBox="0 0 200 50"
              >
                <polyline
                  className="transition-all duration-200"
                  fill="none"
                  points={chartData.polyline}
                  stroke="#16a34a"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />
                {hover && (
                  <g>
                    <circle
                      cx={(hover.x / 200) * 200}
                      cy={(hover.y / 50) * 50}
                      fill="#16a34a"
                      opacity="0.9"
                      r="3"
                    />
                    <rect
                      fill="rgba(0,0,0,0.75)"
                      height="18"
                      rx="4"
                      width="44"
                      x={(hover.x / 200) * 200 - 22}
                      y={(hover.y / 50) * 50 - 28}
                    />
                    <text
                      fill="white"
                      fontFamily="sans-serif"
                      fontSize="9"
                      x={(hover.x / 200) * 200 - 20}
                      y={(hover.y / 50) * 50 - 14}
                    >
                      ₦{hover.value}
                    </text>
                  </g>
                )}
              </svg>
            </div>

            {/* Price Stats - Right */}
            <div className="flex flex-shrink-0 items-center gap-2">
              <div className="text-right">
                <p className="font-bold text-gray-900 text-xl dark:text-gray-100">
                  ₦{selectedCoin.priceNgn}
                </p>
                <div className="flex items-center justify-end gap-2 font-semibold text-xs">
                  <div
                    className={
                      selectedCoin.percentChange >= 0
                        ? "flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-green-700"
                        : "flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-red-700"
                    }
                  >
                    <span className="text-sm leading-none">
                      {selectedCoin.percentChange >= 0 ? "▲" : "▼"}
                    </span>
                    <span className="text-sm leading-none">
                      {Math.abs(selectedCoin.percentChange)}%
                    </span>
                  </div>
                  <span className="text-gray-500">Today</span>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <CogIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </Card>

        {/* Swap Card - Main Swap Interface */}
        <Card className="overflow-hidden p-3 md:p-4" forceRounded>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm dark:text-gray-100">
              {selectedCoin.name}
            </h3>
            <button
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 font-semibold text-gray-700 text-xs hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300"
              onClick={() =>
                setDirection((prev) =>
                  prev === "fiatToToken" ? "tokenToFiat" : "fiatToToken"
                )
              }
              title="Reverse swap direction"
            >
              <ArrowsRightLeftIcon className="h-3 w-3" />
            </button>
          </div>

          {/* From Input */}
          <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-1 flex items-center justify-between text-gray-500 text-xs">
              <span>{selectedCoin.name}</span>
              <span className="text-gray-600 dark:text-gray-400">
                Balance: ₦{selectedCoin.balanceNgn.toLocaleString()}
              </span>
            </div>
            <Input
              aria-label="Amount in NGN"
              className="font-semibold text-lg"
              onChange={(event) =>
                setFromFiat(event.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="1,000"
              prefix="₦"
              value={fiatOutput}
            />
          </div>

          {/* Exchange Rate Display */}
          <div className="mb-2 flex items-center justify-between text-gray-600 text-xs">
            <span>
              ≈ {Number(computed.token).toFixed(2)} {selectedCoin.symbol}
            </span>
            <button className="text-gray-400">
              <img
                alt={selectedCoin.name}
                className="h-5 w-5 rounded-full"
                src={selectedCoin.avatarUrl}
              />
            </button>
          </div>

          {/* To Output */}
          <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-1 flex items-center justify-between text-gray-500 text-xs">
              <span>{selectedCoin.symbol}</span>
              <span className="text-gray-600 dark:text-gray-400">
                Balance: {selectedCoin.balanceToken.toFixed(0)}{" "}
                {selectedCoin.symbol}
              </span>
            </div>
            <Input
              aria-label="Amount in token"
              className="font-semibold text-lg"
              onChange={(event) =>
                setToToken(event.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="11.36"
              prefix={selectedCoin.symbol}
              value={tokenOutput}
            />
          </div>

          {/* Primary CTA Button */}
          <Button className="w-full rounded-lg border-none bg-green-600 py-3 font-semibold text-base text-white hover:bg-green-700">
            Buy {selectedCoin.name}
          </Button>
          <p className="mt-1 text-center text-gray-500 text-xs">
            Instant transaction. No crypto needed.
          </p>
        </Card>

        {/* Creator Coins (coin selection) */}
        <Card className="overflow-hidden p-3" forceRounded>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-gray-900 text-sm dark:text-gray-100">
              Select coin
            </p>
            <span className="text-gray-500 text-xs">Tap a coin to swap</span>
          </div>
          <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {coins.map((entry) => {
              const active = entry.symbol === selectedCoin.symbol;
              return (
                <button
                  className={
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition" +
                    (active
                      ? "border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-950/30"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600")
                  }
                  key={entry.symbol}
                  onClick={() => setSelectedCoin(entry)}
                >
                  <img
                    alt={entry.name}
                    className="h-8 w-8 rounded-full"
                    src={entry.avatarUrl}
                  />
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {entry.symbol}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

export default Swap;
