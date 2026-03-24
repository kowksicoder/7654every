import {
  ArrowPathIcon,
  ClipboardDocumentIcon,
  PauseIcon,
  PlayIcon
} from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Address } from "viem";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { base } from "viem/chains";
import Loader from "@/components/Shared/Loader";
import { Button, Card, ErrorMessage, Select } from "@/components/Shared/UI";
import { BASE_RPC_URL } from "@/data/constants";
import formatRelativeOrAbsolute from "@/helpers/datetime/formatRelativeOrAbsolute";
import { getCollaborationRuntimeConfig } from "@/helpers/every1";
import formatAddress from "@/helpers/formatAddress";
import nFormatter from "@/helpers/nFormatter";
import {
  getStaffCollaborationPayoutSummary,
  listStaffCollaborationPayouts,
  listStaffCollaborationSettlements,
  STAFF_COLLABORATION_PAYOUT_SUMMARY_QUERY_KEY,
  STAFF_COLLABORATION_PAYOUTS_QUERY_KEY,
  STAFF_COLLABORATION_SETTLEMENTS_QUERY_KEY,
  staffRetryCollaborationPayout,
  staffRetryFailedCollaborationPayouts,
  staffSetCollaborationPayoutPause
} from "@/helpers/staff";
import useCopyToClipboard from "@/hooks/useCopyToClipboard";
import type {
  StaffCollaborationPayoutRow,
  StaffCollaborationSettlementRow
} from "@/types/staff";

const payoutStatusMeta: Record<
  StaffCollaborationPayoutRow["status"],
  { className: string; label: string }
> = {
  failed: {
    className:
      "bg-rose-500/12 text-rose-700 dark:bg-rose-500/12 dark:text-rose-300",
    label: "Failed"
  },
  paid: {
    className:
      "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300",
    label: "Paid"
  },
  recorded: {
    className:
      "bg-sky-500/12 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300",
    label: "Queued"
  }
};

const formatTokenAmount = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 100 ? 0 : value >= 1 ? 2 : 4,
    minimumFractionDigits: 0
  }).format(value);
};

const getProfileLabel = (
  displayName?: null | string,
  username?: null | string,
  walletAddress?: null | string
) =>
  displayName || username || formatAddress(walletAddress || "", 6) || "Unknown";

const formatSourceType = (value: string) =>
  value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const settlementStatusMeta = (
  settlement: StaffCollaborationSettlementRow,
  availableBalance: number
) => {
  if (settlement.payoutsPaused) {
    return {
      className:
        "bg-amber-500/12 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300",
      label: "Paused"
    };
  }

  const outstanding = settlement.queuedAmount + settlement.failedAmount;

  if (outstanding <= 0) {
    return {
      className:
        "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300",
      label: "Settled"
    };
  }

  if (availableBalance >= outstanding) {
    return {
      className:
        "bg-sky-500/12 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300",
      label: "Funded"
    };
  }

  return {
    className:
      "bg-rose-500/12 text-rose-700 dark:bg-rose-500/12 dark:text-rose-300",
    label: "Shortfall"
  };
};

const CollaborationPayoutManager = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<
    "all" | StaffCollaborationPayoutRow["status"]
  >("all");
  const [retryingAllocationId, setRetryingAllocationId] = useState<
    null | string
  >(null);
  const [isBulkRetrying, setIsBulkRetrying] = useState(false);
  const [togglingCollaborationId, setTogglingCollaborationId] = useState<
    null | string
  >(null);
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL, { batch: { batchSize: 20 } })
      }),
    []
  );
  const runtimeConfigQuery = useQuery({
    queryFn: getCollaborationRuntimeConfig,
    queryKey: ["collaboration-runtime-config"],
    staleTime: 60000
  });
  const summaryQuery = useQuery({
    queryFn: getStaffCollaborationPayoutSummary,
    queryKey: [STAFF_COLLABORATION_PAYOUT_SUMMARY_QUERY_KEY]
  });
  const settlementsQuery = useQuery({
    queryFn: () => listStaffCollaborationSettlements({ limit: 60 }),
    queryKey: [STAFF_COLLABORATION_SETTLEMENTS_QUERY_KEY]
  });
  const copyPayoutWallet = useCopyToClipboard(
    runtimeConfigQuery.data?.payoutWalletAddress || "",
    "Payout wallet copied"
  );

  const payoutsQuery = useQuery({
    queryFn: () =>
      listStaffCollaborationPayouts({
        limit: 150,
        status: statusFilter === "all" ? null : statusFilter
      }),
    queryKey: [STAFF_COLLABORATION_PAYOUTS_QUERY_KEY, statusFilter]
  });

  const payouts = payoutsQuery.data || [];
  const settlements = settlementsQuery.data || [];
  const payoutSummary = summaryQuery.data;
  const filteredCounts = useMemo(
    () => ({
      failed: payouts.filter((item) => item.status === "failed").length,
      paid: payouts.filter((item) => item.status === "paid").length,
      recorded: payouts.filter((item) => item.status === "recorded").length
    }),
    [payouts]
  );
  const fundingBalancesQuery = useQuery({
    enabled: Boolean(
      runtimeConfigQuery.data?.payoutWalletAddress && settlements.length
    ),
    queryFn: async () => {
      const uniqueSettlements = Array.from(
        new Map(
          settlements.map((settlement) => [settlement.coinAddress, settlement])
        ).values()
      );
      const contracts = uniqueSettlements.map((settlement) => ({
        abi: erc20Abi,
        address: settlement.coinAddress as Address,
        args: [runtimeConfigQuery.data?.payoutWalletAddress as Address],
        functionName: "balanceOf" as const
      }));

      if (!contracts.length) {
        return {} as Record<string, number>;
      }

      const balances = await publicClient.multicall({
        allowFailure: true,
        contracts
      });

      return Object.fromEntries(
        balances.map((result, index) => {
          const settlement = uniqueSettlements[index];
          const value =
            result.status === "success"
              ? Number(
                  formatUnits(
                    result.result,
                    settlement?.rewardTokenDecimals || 18
                  )
                )
              : 0;

          return [settlement.coinAddress.toLowerCase(), value];
        })
      ) satisfies Record<string, number>;
    },
    queryKey: [
      "staff-collaboration-payout-wallet-balances",
      runtimeConfigQuery.data?.payoutWalletAddress,
      settlements
        .map(
          (settlement) =>
            `${settlement.coinAddress}:${settlement.rewardTokenDecimals}`
        )
        .join("|")
    ],
    staleTime: 60000
  });
  const fundingBalances = fundingBalancesQuery.data || {};

  const invalidateCollaborationPayoutData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [STAFF_COLLABORATION_PAYOUT_SUMMARY_QUERY_KEY]
      }),
      queryClient.invalidateQueries({
        queryKey: [STAFF_COLLABORATION_SETTLEMENTS_QUERY_KEY]
      }),
      queryClient.invalidateQueries({
        queryKey: [STAFF_COLLABORATION_PAYOUTS_QUERY_KEY]
      })
    ]);
  };

  const handleRetry = async (allocationId: string) => {
    try {
      setRetryingAllocationId(allocationId);
      await staffRetryCollaborationPayout(allocationId);
      await invalidateCollaborationPayoutData();
      toast.success("Collaboration payout re-queued");
    } catch (error) {
      console.error("Failed to retry collaboration payout", error);
      toast.error("Couldn't re-queue this payout.");
    } finally {
      setRetryingAllocationId(null);
    }
  };

  const handleRetryAll = async (collaborationId?: null | string) => {
    try {
      setIsBulkRetrying(true);
      const result = await staffRetryFailedCollaborationPayouts(
        collaborationId || null
      );
      await invalidateCollaborationPayoutData();
      toast.success(
        result.retriedCount
          ? `${result.retriedCount} payout${result.retriedCount > 1 ? "s" : ""} re-queued`
          : "No failed payouts needed re-queueing"
      );
    } catch (error) {
      console.error("Failed to bulk retry collaboration payouts", error);
      toast.error("Couldn't re-queue failed collaboration payouts.");
    } finally {
      setIsBulkRetrying(false);
    }
  };

  const handleTogglePause = async (
    settlement: StaffCollaborationSettlementRow
  ) => {
    try {
      setTogglingCollaborationId(settlement.collaborationId);
      const reason = settlement.payoutsPaused
        ? null
        : window.prompt(
            "Optional pause reason for this collaboration payout flow:",
            settlement.payoutsPausedReason || ""
          );

      if (reason === null && !settlement.payoutsPaused) {
        setTogglingCollaborationId(null);
        return;
      }

      await staffSetCollaborationPayoutPause({
        collaborationId: settlement.collaborationId,
        paused: !settlement.payoutsPaused,
        reason
      });
      await invalidateCollaborationPayoutData();
      toast.success(
        settlement.payoutsPaused
          ? "Collaboration payouts resumed"
          : "Collaboration payouts paused"
      );
    } catch (error) {
      console.error("Failed to toggle collaboration payout pause", error);
      toast.error("Couldn't update this collaboration payout state.");
    } finally {
      setTogglingCollaborationId(null);
    }
  };

  return (
    <div className="space-y-3.5">
      <Card className="p-3 md:p-4" forceRounded>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="font-semibold text-[15px] text-gray-950 md:text-base dark:text-gray-50">
              Collaboration payouts
            </h3>
            <p className="mt-0.5 text-[11px] text-gray-500 leading-4 md:text-xs dark:text-gray-400">
              Audit queued, paid, and failed collaboration reward sends. Staff
              can bulk re-queue failures and pause payout sends when a
              collaboration needs review.
            </p>
          </div>

          <div className="flex flex-col gap-2 md:w-auto md:items-end">
            <div className="flex flex-wrap gap-2">
              {runtimeConfigQuery.data?.payoutWalletAddress ? (
                <Button
                  icon={<ClipboardDocumentIcon className="size-4" />}
                  onClick={() => void copyPayoutWallet()}
                  outline
                  size="sm"
                >
                  Copy payout wallet
                </Button>
              ) : null}
              <Button
                disabled={isBulkRetrying}
                onClick={() => void handleRetryAll()}
                outline
                size="sm"
              >
                <ArrowPathIcon className="size-3.5" />
                Retry all failed
              </Button>
            </div>

            <div className="w-full md:w-44">
              <Select
                defaultValue={statusFilter}
                onChange={(value) =>
                  setStatusFilter(
                    value as "all" | StaffCollaborationPayoutRow["status"]
                  )
                }
                options={[
                  {
                    label: "All statuses",
                    selected: statusFilter === "all",
                    value: "all"
                  },
                  {
                    label: "Queued",
                    selected: statusFilter === "recorded",
                    value: "recorded"
                  },
                  {
                    label: "Paid",
                    selected: statusFilter === "paid",
                    value: "paid"
                  },
                  {
                    label: "Failed",
                    selected: statusFilter === "failed",
                    value: "failed"
                  }
                ]}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-2.5">
          <div className="rounded-[1rem] border border-gray-200/75 bg-gray-50 px-3 py-3 dark:border-gray-800/75 dark:bg-gray-950">
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.16em] dark:text-gray-400">
              Queued
            </p>
            <p className="mt-1 font-semibold text-gray-950 text-lg dark:text-gray-50">
              {summaryQuery.isLoading
                ? "--"
                : nFormatter(payoutSummary?.queuedCount || 0, 1)}
            </p>
          </div>
          <div className="rounded-[1rem] border border-gray-200/75 bg-gray-50 px-3 py-3 dark:border-gray-800/75 dark:bg-gray-950">
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.16em] dark:text-gray-400">
              Paid
            </p>
            <p className="mt-1 font-semibold text-gray-950 text-lg dark:text-gray-50">
              {summaryQuery.isLoading
                ? "--"
                : nFormatter(payoutSummary?.paidCount || 0, 1)}
            </p>
          </div>
          <div className="rounded-[1rem] border border-gray-200/75 bg-gray-50 px-3 py-3 dark:border-gray-800/75 dark:bg-gray-950">
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.16em] dark:text-gray-400">
              Failed
            </p>
            <p className="mt-1 font-semibold text-gray-950 text-lg dark:text-gray-50">
              {summaryQuery.isLoading
                ? "--"
                : nFormatter(payoutSummary?.failedCount || 0, 1)}
            </p>
          </div>
          <div className="rounded-[1rem] border border-gray-200/75 bg-gray-50 px-3 py-3 dark:border-gray-800/75 dark:bg-gray-950">
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.16em] dark:text-gray-400">
              Active projects
            </p>
            <p className="mt-1 font-semibold text-gray-950 text-lg dark:text-gray-50">
              {summaryQuery.isLoading
                ? "--"
                : nFormatter(payoutSummary?.activeCollaborationCount || 0, 1)}
            </p>
          </div>
          <div className="rounded-[1rem] border border-gray-200/75 bg-gray-50 px-3 py-3 dark:border-gray-800/75 dark:bg-gray-950">
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.16em] dark:text-gray-400">
              Paused
            </p>
            <p className="mt-1 font-semibold text-gray-950 text-lg dark:text-gray-50">
              {summaryQuery.isLoading
                ? "--"
                : nFormatter(payoutSummary?.pausedCollaborationCount || 0, 1)}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-1 text-[12px] text-gray-500 dark:text-gray-400">
          <p>
            Payout wallet:{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {runtimeConfigQuery.data?.payoutWalletAddress
                ? formatAddress(runtimeConfigQuery.data.payoutWalletAddress, 6)
                : "--"}
            </span>
          </p>
          <p>
            Current filter totals:{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {filteredCounts.recorded} queued | {filteredCounts.paid} paid |{" "}
              {filteredCounts.failed} failed
            </span>
          </p>
          {fundingBalancesQuery.isError ? (
            <p className="text-rose-600 dark:text-rose-300">
              Funding balances could not be checked right now.
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="p-3 md:p-4" forceRounded>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[15px] text-gray-950 md:text-base dark:text-gray-50">
              Settlement overview
            </h3>
            <p className="mt-0.5 text-[11px] text-gray-500 leading-4 md:text-xs dark:text-gray-400">
              See gross revenue, queued and failed obligations, and whether the
              payout wallet can cover each collaboration coin.
            </p>
          </div>
        </div>

        {settlementsQuery.isLoading ? (
          <Loader
            className="py-8"
            message="Loading collaboration settlements..."
          />
        ) : settlementsQuery.error ? (
          <ErrorMessage
            error={settlementsQuery.error}
            title="Failed to load collaboration settlements"
          />
        ) : settlements.length ? (
          <div className="mt-4 space-y-2.5">
            {settlements.map((settlement) => {
              const availableBalance =
                fundingBalances[settlement.coinAddress.toLowerCase()] || 0;
              const status = settlementStatusMeta(settlement, availableBalance);
              const outstandingAmount =
                settlement.queuedAmount + settlement.failedAmount;
              const shortfallAmount = Math.max(
                outstandingAmount - availableBalance,
                0
              );

              return (
                <div
                  className="rounded-[1rem] border border-gray-200/75 px-3 py-3 dark:border-gray-800/75"
                  key={settlement.collaborationId}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                          {settlement.title}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold text-[11px] ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-gray-500 text-xs dark:text-gray-400">
                        {getProfileLabel(
                          settlement.ownerName,
                          settlement.ownerUsername,
                          null
                        )}{" "}
                        | {"\u20A6"}
                        {settlement.ticker}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={
                          togglingCollaborationId === settlement.collaborationId
                        }
                        onClick={() => void handleTogglePause(settlement)}
                        outline
                        size="sm"
                      >
                        {settlement.payoutsPaused ? (
                          <PlayIcon className="size-3.5" />
                        ) : (
                          <PauseIcon className="size-3.5" />
                        )}
                        {settlement.payoutsPaused
                          ? "Resume payouts"
                          : "Pause payouts"}
                      </Button>
                      <Button
                        disabled={
                          isBulkRetrying || settlement.failedCount === 0
                        }
                        onClick={() =>
                          void handleRetryAll(settlement.collaborationId)
                        }
                        outline
                        size="sm"
                      >
                        <ArrowPathIcon className="size-3.5" />
                        Retry failed
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                    <div className="rounded-[1rem] border border-gray-200/75 bg-gray-50 px-3 py-3 dark:border-gray-800/75 dark:bg-gray-950">
                      <p className="text-[10px] text-gray-500 uppercase tracking-[0.16em] dark:text-gray-400">
                        Gross
                      </p>
                      <p className="mt-1 font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {formatTokenAmount(settlement.grossAmount)}{" "}
                        {settlement.coinSymbol}
                      </p>
                    </div>
                    <div className="rounded-[1rem] border border-gray-200/75 bg-gray-50 px-3 py-3 dark:border-gray-800/75 dark:bg-gray-950">
                      <p className="text-[10px] text-gray-500 uppercase tracking-[0.16em] dark:text-gray-400">
                        Paid
                      </p>
                      <p className="mt-1 font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {formatTokenAmount(settlement.paidAmount)}{" "}
                        {settlement.coinSymbol}
                      </p>
                    </div>
                    <div className="rounded-[1rem] border border-gray-200/75 bg-gray-50 px-3 py-3 dark:border-gray-800/75 dark:bg-gray-950">
                      <p className="text-[10px] text-gray-500 uppercase tracking-[0.16em] dark:text-gray-400">
                        Queued
                      </p>
                      <p className="mt-1 font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {formatTokenAmount(settlement.queuedAmount)}{" "}
                        {settlement.coinSymbol}
                      </p>
                    </div>
                    <div className="rounded-[1rem] border border-gray-200/75 bg-gray-50 px-3 py-3 dark:border-gray-800/75 dark:bg-gray-950">
                      <p className="text-[10px] text-gray-500 uppercase tracking-[0.16em] dark:text-gray-400">
                        Failed
                      </p>
                      <p className="mt-1 font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {formatTokenAmount(settlement.failedAmount)}{" "}
                        {settlement.coinSymbol}
                      </p>
                    </div>
                    <div className="rounded-[1rem] border border-gray-200/75 bg-gray-50 px-3 py-3 dark:border-gray-800/75 dark:bg-gray-950">
                      <p className="text-[10px] text-gray-500 uppercase tracking-[0.16em] dark:text-gray-400">
                        Wallet cover
                      </p>
                      <p className="mt-1 font-semibold text-gray-950 text-sm dark:text-gray-50">
                        {formatTokenAmount(availableBalance)}{" "}
                        {settlement.coinSymbol}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-1 text-[12px] text-gray-500 dark:text-gray-400">
                    <p>
                      Sources:{" "}
                      <span className="font-semibold text-gray-700 dark:text-gray-200">
                        {settlement.sourceTypes.length
                          ? settlement.sourceTypes
                              .map(formatSourceType)
                              .join(", ")
                          : "No revenue sources yet"}
                      </span>
                    </p>
                    <p>
                      Outstanding:{" "}
                      <span className="font-semibold text-gray-700 dark:text-gray-200">
                        {formatTokenAmount(outstandingAmount)}{" "}
                        {settlement.coinSymbol}
                      </span>
                      {shortfallAmount > 0 ? (
                        <span className="text-rose-600 dark:text-rose-300">
                          {" "}
                          | shortfall {formatTokenAmount(shortfallAmount)}{" "}
                          {settlement.coinSymbol}
                        </span>
                      ) : null}
                    </p>
                    {settlement.payoutsPausedReason ? (
                      <p className="text-amber-700 dark:text-amber-300">
                        Pause reason: {settlement.payoutsPausedReason}
                      </p>
                    ) : null}
                    <p>
                      Latest activity{" "}
                      <span className="font-semibold text-gray-700 dark:text-gray-200">
                        {settlement.lastActivityAt
                          ? formatRelativeOrAbsolute(settlement.lastActivityAt)
                          : "No activity yet"}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm dark:text-gray-400">
            No collaboration settlement activity yet.
          </p>
        )}
      </Card>

      <Card className="p-3 md:p-4" forceRounded>
        {payoutsQuery.isLoading ? (
          <Loader className="py-8" message="Loading collaboration payouts..." />
        ) : payoutsQuery.error ? (
          <ErrorMessage
            error={payoutsQuery.error}
            title="Failed to load collaboration payouts"
          />
        ) : payouts.length ? (
          <div className="space-y-2.5">
            {payouts.map((payout) => {
              const status = payoutStatusMeta[payout.status];

              return (
                <div
                  className="rounded-[1rem] border border-gray-200/75 px-3 py-3 dark:border-gray-800/75"
                  key={payout.allocationId}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-gray-950 text-sm dark:text-gray-50">
                          {payout.title}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold text-[11px] ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-gray-500 text-xs dark:text-gray-400">
                        {"\u20A6"}
                        {payout.ticker} | {formatTokenAmount(payout.amount)}{" "}
                        {payout.coinSymbol}
                      </p>
                    </div>

                    {payout.status === "failed" ? (
                      <Button
                        disabled={retryingAllocationId === payout.allocationId}
                        onClick={() => void handleRetry(payout.allocationId)}
                        outline
                        size="sm"
                      >
                        <ArrowPathIcon className="size-3.5" />
                        Retry payout
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-1 text-[12px] text-gray-500 dark:text-gray-400">
                    <p>
                      Owner:{" "}
                      <span className="font-semibold text-gray-700 dark:text-gray-200">
                        {getProfileLabel(
                          payout.ownerName,
                          payout.ownerUsername,
                          null
                        )}
                      </span>
                    </p>
                    <p>
                      Recipient:{" "}
                      <span className="font-semibold text-gray-700 dark:text-gray-200">
                        {getProfileLabel(
                          payout.recipientName,
                          payout.recipientUsername,
                          payout.recipientWalletAddress
                        )}
                      </span>
                    </p>
                    <p>
                      Split:{" "}
                      <span className="font-semibold text-gray-700 dark:text-gray-200">
                        {payout.splitPercent}%
                      </span>
                    </p>
                    <p>
                      Recorded {formatRelativeOrAbsolute(payout.createdAt)}
                      {payout.sentAt
                        ? ` | paid ${formatRelativeOrAbsolute(payout.sentAt)}`
                        : payout.payoutAttemptedAt
                          ? ` | attempted ${formatRelativeOrAbsolute(payout.payoutAttemptedAt)}`
                          : ""}
                    </p>
                    {payout.txHash ? (
                      <p>
                        Tx:{" "}
                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                          {formatAddress(payout.txHash, 8)}
                        </span>
                      </p>
                    ) : null}
                    {payout.errorMessage ? (
                      <p className="text-rose-600 dark:text-rose-300">
                        {payout.errorMessage}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm dark:text-gray-400">
            No collaboration payouts match this filter yet.
          </p>
        )}
      </Card>
    </div>
  );
};

export default CollaborationPayoutManager;
