import {
  BoltIcon,
  RocketLaunchIcon,
  SparklesIcon
} from "@heroicons/react/24/outline";
import { type ElementType, memo, useEffect, useState } from "react";
import { Button, Modal } from "@/components/Shared/UI";
import cn from "@/helpers/cn";

type ProductTourModalProps = {
  onClose: () => void;
  onLaunchCoin?: () => void;
  show: boolean;
};

type ProductTourStep = {
  body: string;
  highlights: string[];
  icon: ElementType;
  label: string;
  title: string;
};

const TOUR_STEPS: ProductTourStep[] = [
  {
    body: "Your feed brings creators, coins, and live momentum together in one scroll.",
    highlights: ["Watch live creators", "Open any coin fast"],
    icon: SparklesIcon,
    label: "Discover",
    title: "See what is moving"
  },
  {
    body: "Top up, buy creator coins, sell later, and track everything from one wallet flow.",
    highlights: ["Trade in Naira", "Check holdings and history"],
    icon: BoltIcon,
    label: "Trade",
    title: "Move fast without crypto clutter"
  },
  {
    body: "Launch a creator, community, or collaboration coin whenever you are ready.",
    highlights: ["Create in one flow", "FanDrops and communities built in"],
    icon: RocketLaunchIcon,
    label: "Launch",
    title: "Turn your audience into momentum"
  }
];

const ProductTourModal = ({
  onClose,
  onLaunchCoin,
  show
}: ProductTourModalProps) => {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!show) {
      setActiveStep(0);
    }
  }, [show]);

  const step = TOUR_STEPS[activeStep];
  const isLastStep = activeStep === TOUR_STEPS.length - 1;
  const Icon = step.icon;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
      return;
    }

    setActiveStep((current) => current + 1);
  };

  return (
    <Modal onClose={onClose} show={show} size="xs">
      <div className="px-4 py-4 md:px-5 md:py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-[10px] text-gray-500 uppercase tracking-[0.18em] dark:text-gray-400">
              Quick tour
            </p>
            <p className="mt-1 text-balance font-semibold text-[15px] text-gray-950 leading-5 md:text-base dark:text-gray-50">
              Learn Every1 in under a minute
            </p>
          </div>
          <button
            className="rounded-full px-2 py-1 text-[11px] text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/8 dark:hover:text-white"
            onClick={onClose}
            type="button"
          >
            Skip
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {TOUR_STEPS.map((tourStep, index) => (
            <div
              className={cn(
                "h-1.5 flex-1 rounded-full transition",
                index === activeStep
                  ? "bg-gray-950 dark:bg-white"
                  : "bg-gray-200 dark:bg-white/12"
              )}
              key={tourStep.label}
            />
          ))}
        </div>

        <div className="mt-4 rounded-[24px] border border-gray-200 bg-gray-50 px-4 py-4 dark:border-white/8 dark:bg-white/5">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/16 dark:bg-sky-500/14 dark:text-sky-300 dark:ring-sky-500/20">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[10px] text-gray-500 uppercase tracking-[0.16em] dark:text-gray-400">
                {step.label}
              </p>
              <p className="mt-1 text-balance font-semibold text-[15px] text-gray-950 leading-5 dark:text-gray-50">
                {step.title}
              </p>
              <p className="mt-1.5 text-[12px] text-gray-500 leading-5 dark:text-gray-400">
                {step.body}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            {step.highlights.map((highlight) => (
              <div
                className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-[12px] text-gray-700 leading-5 dark:border-white/8 dark:bg-[#101114] dark:text-gray-200"
                key={highlight}
              >
                {highlight}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            {activeStep + 1} / {TOUR_STEPS.length}
          </div>
          <div className="flex items-center gap-2">
            {activeStep > 0 ? (
              <Button
                onClick={() => setActiveStep((current) => current - 1)}
                outline
                size="sm"
              >
                Back
              </Button>
            ) : null}
            {isLastStep && onLaunchCoin ? (
              <Button onClick={onLaunchCoin} outline size="sm">
                Launch a coin
              </Button>
            ) : null}
            <Button onClick={handleNext} size="sm">
              {isLastStep ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default memo(ProductTourModal);
