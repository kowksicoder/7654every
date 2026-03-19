import {
  ArrowsRightLeftIcon,
  GiftTopIcon,
  SparklesIcon
} from "@heroicons/react/24/solid";
import { useMemo, useState } from "react";
import PageLayout from "@/components/Shared/PageLayout";
import { Button, Card, Input } from "@/components/Shared/UI";

const coin = {
  balanceNgn: 2500,
  balanceToken: 30,
  holders: 450,
  name: "AyoCoin",
  percentChange: 4.2,
  priceNgn: 85,
  symbol: "AYC",
  volume: 210000
};

const createTopCoin = (name: string, symbol: string, color: string) => ({
  color,
  name,
  symbol
});

const topCoins = [
  createTopCoin("WizCoin", "WIZ", "bg-green-500"),
  createTopCoin("FunmiCoin", "FUN", "bg-orange-500"),
  createTopCoin("YemiCoin", "YEM", "bg-blue-500")
];

const Swap = () => {
  const [fromFiat, setFromFiat] = useState("1000");
  const [toToken, setToToken] = useState("11.76");
  const [direction, setDirection] = useState<"fiatToToken" | "tokenToFiat">(
    "fiatToToken"
  );

  const parsedFiat = Number(fromFiat);

  const computed = useMemo(() => {
    if (!Number.isFinite(parsedFiat) || parsedFiat < 0) {
      return { fiat: "0", token: "0.00" };
    }
    if (direction === "fiatToToken") {
      const tokenCalc = parsedFiat / coin.priceNgn;
      return {
        fiat: parsedFiat.toLocaleString("en-NG"),
        token: tokenCalc.toFixed(2)
      };
    }
    const parsedToken = Number(toToken);
    if (!Number.isFinite(parsedToken) || parsedToken < 0)
      return { fiat: "0", token: "0.00" };
    const fiatCalc = parsedToken * coin.priceNgn;
    return {
      fiat: fiatCalc.toLocaleString("en-NG"),
      token: parsedToken.toFixed(2)
    };
  }, [direction, parsedFiat, toToken]);

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
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 md:px-0">
        <Card className="overflow-hidden p-5" forceRounded>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                alt="AyoCoin"
                className="h-12 w-12 rounded-full border border-gray-200 object-cover"
                src="/buycoin.png"
              />
              <div>
                <p className="font-bold text-gray-900 text-lg dark:text-gray-100">
                  {coin.name}
                </p>
                <p className="text-gray-500 text-sm">{coin.symbol}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-2xl text-gray-900 dark:text-gray-100">
                ₦{coin.priceNgn.toLocaleString()}
              </p>
              <p className="font-semibold text-green-600 text-sm">
                +{coin.percentChange}% Today
              </p>
            </div>
          </div>

          <div className="mt-4 h-20 w-full rounded-xl bg-gradient-to-r from-green-100 via-green-50 to-indigo-50 p-3">
            <div className="h-full w-full rounded-xl bg-white/50 p-3">
              <svg className="h-full w-full" viewBox="0 0 200 50">
                <polyline
                  fill="none"
                  points="0,35 30,33 60,20 90,22 120,17 150,20 180,10 200,6"
                  stroke="#16a34a"
                  strokeWidth="3"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden p-5" forceRounded>
          <div className="mb-4 flex items-center justify-between text-gray-500 text-sm">
            <span className="font-semibold text-gray-600 dark:text-gray-300">
              Swap
            </span>
            <button
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 text-xs hover:bg-gray-100"
              onClick={() =>
                setDirection((prev) =>
                  prev === "fiatToToken" ? "tokenToFiat" : "fiatToToken"
                )
              }
            >
              <ArrowsRightLeftIcon className="h-4 w-4" />
              Reverse
            </button>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between text-gray-500 text-sm">
                <span>
                  {direction === "fiatToToken"
                    ? "From (NGN)"
                    : `From (${coin.symbol})`}
                </span>
                <span>Balance: ₦{coin.balanceNgn.toLocaleString()}</span>
              </div>
              <Input
                aria-label="Amount in fiat"
                className="font-semibold text-lg"
                onChange={(event) =>
                  setFromFiat(event.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="1,000"
                prefix="₦"
                value={fiatOutput}
              />
            </div>

            <div className="text-center text-gray-500 text-xs">
              ≈ {Number(computed.token).toFixed(2)} {coin.symbol}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between text-gray-500 text-sm">
                <span>
                  {direction === "fiatToToken"
                    ? `To (${coin.symbol})`
                    : "To (NGN)"}
                </span>
                <span>
                  Balance: {coin.balanceToken.toFixed(0)} {coin.symbol}
                </span>
              </div>
              <Input
                aria-label="Amount in token"
                className="font-semibold text-lg"
                onChange={(event) =>
                  setToToken(event.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="11.36"
                prefix={coin.symbol}
                value={tokenOutput}
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-amber-700 text-sm">
            Note: Price may change by the time the swap completes.
          </div>

          <Button className="mt-4 w-full py-3" size="lg">
            Buy {coin.name}
          </Button>
        </Card>

        <Card className="overflow-hidden p-5" forceRounded>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-lg">
              Price Trend (7 Days)
            </h2>
            <span className="text-gray-500 text-sm">7D</span>
          </div>
          <div className="mb-3 h-20 w-full rounded-xl bg-gradient-to-r from-blue-50 via-cyan-50 to-green-50 p-2">
            <svg className="h-full w-full" viewBox="0 0 200 50">
              <polyline
                fill="none"
                points="0,40 25,36 50,28 75,30 100,25 125,28 150,23 175,18 200,14"
                stroke="#0f766e"
                strokeWidth="3"
              />
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-3 text-gray-600 text-sm">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-gray-500 text-xs uppercase">Holders</p>
              <p className="font-semibold text-gray-900">
                {coin.holders.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-gray-500 text-xs uppercase">Volume</p>
              <p className="font-semibold text-gray-900">
                ₦{coin.volume.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
          <Button
            className="w-full py-3"
            icon={<SparklesIcon className="h-4 w-4" />}
            outline
            size="lg"
          >
            Tip Ayo
          </Button>
          <Button
            className="w-full py-3"
            icon={<GiftTopIcon className="h-4 w-4" />}
            outline
            size="lg"
          >
            Gift Coins
          </Button>
        </div>

        <Card className="overflow-hidden p-4" forceRounded>
          <p className="mb-3 font-semibold text-gray-600 text-sm">
            Top creator coins
          </p>
          <div className="flex flex-wrap gap-2">
            {topCoins.map((entry) => (
              <div
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm"
                key={entry.symbol}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-white ${entry.color}`}
                >
                  {entry.symbol[0]}
                </span>
                <span>{entry.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

export default Swap;
