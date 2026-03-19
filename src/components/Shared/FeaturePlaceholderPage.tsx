import type { ReactNode } from "react";
import PageLayout from "@/components/Shared/PageLayout";
import { Card } from "@/components/Shared/UI";
import cn from "@/helpers/cn";

interface FeaturePlaceholderPageProps {
  accentClassName: string;
  bullets: string[];
  description: string;
  eyebrow: string;
  icon: ReactNode;
  statusPills: string[];
  title: string;
}

const FeaturePlaceholderPage = ({
  accentClassName,
  bullets,
  description,
  eyebrow,
  icon,
  statusPills,
  title
}: FeaturePlaceholderPageProps) => {
  return (
    <PageLayout description={description} title={title}>
      <Card
        className="relative mx-5 overflow-hidden px-5 py-6 md:mx-0 md:px-6"
        forceRounded
      >
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 rounded-t-xl",
            accentClassName
          )}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-12 items-center justify-center rounded-2xl text-white shadow-sm",
                  accentClassName
                )}
              >
                {icon}
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gray-500">
                {eyebrow}
              </p>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-gray-950 dark:text-gray-50">
                {title}
              </h1>
              <p className="max-w-xl text-sm text-gray-600 dark:text-gray-400">
                {description}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusPills.map((pill) => (
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

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="mx-5 px-5 py-6 md:mx-0 md:px-6" forceRounded>
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
              What We&apos;ll Build Here
            </p>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              {bullets.map((bullet) => (
                <p key={bullet}>{bullet}</p>
              ))}
            </div>
          </div>
        </Card>

        <Card className="mx-5 px-5 py-6 md:mx-0 md:px-6" forceRounded>
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
              Current State
            </p>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>The route is live and linked in the desktop sidebar.</p>
              <p>The layout is staged so we can plug real data and actions in next.</p>
              <p>No backend or protocol integration is wired here yet.</p>
            </div>
          </div>
        </Card>
      </div>
    </PageLayout>
  );
};

export default FeaturePlaceholderPage;
