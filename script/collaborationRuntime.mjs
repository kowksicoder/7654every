import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  isAddress
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const stripQuotes = (value) => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
};

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }

  const raw = readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim());

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

const jsonResponse = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
};

const normalizeAddress = (value) => {
  const trimmed = value?.trim().toLowerCase();
  return trimmed && isAddress(trimmed) ? trimmed : null;
};

const getRecipientLabel = (allocation) =>
  allocation.recipientDisplayName ||
  allocation.recipientUsername ||
  allocation.recipientWalletAddress ||
  "this collaborator";

const createNotification = async (
  { body, data, recipientId, targetKey, title },
  supabase
) => {
  const { data: row, error } = await supabase
    .from("notifications")
    .insert({
      actor_id: null,
      body: body || null,
      data: data || {},
      kind: "reward",
      recipient_id: recipientId,
      target_key: targetKey || null,
      title
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return row?.id || null;
};

export const createCollaborationRuntime = ({ rootDir }) => {
  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const rpcUrl =
    process.env.VITE_ZORA_RPC_URL ||
    process.env.PONDER_RPC_URL_8453 ||
    process.env.VITE_BASE_RPC_URL ||
    "https://base.llamarpc.com";
  const payoutPrivateKey =
    process.env.PLATFORM_PRIVATE_KEY || process.env.PRIVATE_KEY || null;
  const payoutAccount =
    payoutPrivateKey && /^0x[a-fA-F0-9]{64}$/.test(payoutPrivateKey)
      ? privateKeyToAccount(payoutPrivateKey)
      : null;
  const runtimeEnabled = Boolean(supabaseUrl && serviceRoleKey && rpcUrl);
  const payoutEnabled = Boolean(runtimeEnabled && payoutAccount);
  const payoutWalletAddress = payoutAccount?.address?.toLowerCase() || null;
  const supabase = runtimeEnabled
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
    : null;
  const publicClient = runtimeEnabled
    ? createPublicClient({
        chain: base,
        transport: http(rpcUrl, { batch: { batchSize: 20 } })
      })
    : null;
  const walletClient =
    payoutEnabled && payoutAccount
      ? createWalletClient({
          account: payoutAccount,
          chain: base,
          transport: http(rpcUrl, { batch: { batchSize: 20 } })
        })
      : null;
  let payoutInterval = null;
  let isDispatching = false;

  const markAllocationFailed = async (allocation, message) => {
    if (!supabase) {
      return;
    }

    const shouldNotify =
      allocation.status !== "failed" || allocation.errorMessage !== message;

    await supabase
      .from("collaboration_earning_allocations")
      .update({
        error_message: message,
        payout_attempted_at: new Date().toISOString(),
        status: "failed"
      })
      .eq("id", allocation.id);

    if (!shouldNotify) {
      return;
    }

    await createNotification(
      {
        body: `We couldn't send ${allocation.amount} ${allocation.coinSymbol} from "${allocation.title}" yet. ${message}`,
        data: {
          amount: allocation.amount,
          coinAddress: allocation.coinAddress,
          coinSymbol: allocation.coinSymbol,
          collaborationId: allocation.collaborationId,
          status: "failed"
        },
        recipientId: allocation.profileId,
        targetKey: `/coins/${allocation.coinAddress}`,
        title: "Collaboration payout delayed"
      },
      supabase
    );

    if (
      allocation.ownerProfileId &&
      allocation.ownerProfileId !== allocation.profileId
    ) {
      await createNotification(
        {
          body: `A payout for ${getRecipientLabel(allocation)} from "${allocation.title}" needs attention. ${message}`,
          data: {
            amount: allocation.amount,
            coinAddress: allocation.coinAddress,
            coinSymbol: allocation.coinSymbol,
            collaborationId: allocation.collaborationId,
            recipientProfileId: allocation.profileId,
            status: "failed"
          },
          recipientId: allocation.ownerProfileId,
          targetKey: `/coins/${allocation.coinAddress}`,
          title: "Collaboration payout attention needed"
        },
        supabase
      );
    }
  };

  const listPendingAllocations = async () => {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from("collaboration_earning_allocations")
      .select(
        "id, collaboration_id, launch_id, profile_id, recipient_wallet_address, coin_address, coin_symbol, reward_token_decimals, reward_amount_raw, amount, status, payout_attempted_at, error_message"
      )
      .in("status", ["recorded", "failed"])
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) {
      throw error;
    }

    const collaborationIds = Array.from(
      new Set((data || []).map((row) => row.collaboration_id).filter(Boolean))
    );
    const launchIds = Array.from(
      new Set((data || []).map((row) => row.launch_id).filter(Boolean))
    );
    const profileIds = Array.from(
      new Set((data || []).map((row) => row.profile_id).filter(Boolean))
    );
    const collaborationMap = new Map();
    const launchMap = new Map();
    const profileMap = new Map();

    if (collaborationIds.length) {
      const { data: collaborationRows, error: collaborationError } =
        await supabase
          .from("creator_collaborations")
          .select(
            "id, launch_id, owner_id, payouts_paused, payouts_paused_reason, split_locked_at, status, title"
          )
          .in("id", collaborationIds);

      if (collaborationError) {
        throw collaborationError;
      }

      for (const row of collaborationRows || []) {
        collaborationMap.set(row.id, row);
      }
    }

    const launchIdsFromCollaborations = Array.from(
      new Set(
        Array.from(collaborationMap.values())
          .map((row) => row.launch_id)
          .filter(Boolean)
      )
    );

    const allLaunchIds = Array.from(
      new Set([...launchIds, ...launchIdsFromCollaborations])
    );

    if (allLaunchIds.length) {
      const { data: launchRows, error: launchError } = await supabase
        .from("creator_launches")
        .select("id, coin_address, status")
        .in("id", allLaunchIds);

      if (launchError) {
        throw launchError;
      }

      for (const row of launchRows || []) {
        launchMap.set(row.id, row);
      }
    }

    const ownerIds = Array.from(
      new Set(
        Array.from(collaborationMap.values())
          .map((row) => row.owner_id)
          .filter(Boolean)
      )
    );

    const allProfileIds = Array.from(new Set([...profileIds, ...ownerIds]));

    if (allProfileIds.length) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, id, username, wallet_address")
        .in("id", allProfileIds);

      if (profileError) {
        throw profileError;
      }

      for (const row of profileRows || []) {
        profileMap.set(row.id, row);
      }
    }

    return (data || []).map((row) => ({
      amount: row.amount,
      coinAddress: row.coin_address,
      coinSymbol: row.coin_symbol,
      collaborationId: row.collaboration_id,
      collaborationStatus:
        collaborationMap.get(row.collaboration_id)?.status || null,
      currentWalletAddress:
        profileMap.get(row.profile_id)?.wallet_address?.toLowerCase() || null,
      errorMessage: row.error_message,
      id: row.id,
      launchStatus:
        launchMap.get(
          row.launch_id || collaborationMap.get(row.collaboration_id)?.launch_id
        )?.status || null,
      ownerProfileId:
        collaborationMap.get(row.collaboration_id)?.owner_id || null,
      payoutAttemptedAt: row.payout_attempted_at,
      payoutsPaused:
        collaborationMap.get(row.collaboration_id)?.payouts_paused || false,
      payoutsPausedReason:
        collaborationMap.get(row.collaboration_id)?.payouts_paused_reason ||
        null,
      profileId: row.profile_id,
      recipientDisplayName:
        profileMap.get(row.profile_id)?.display_name || null,
      recipientUsername: profileMap.get(row.profile_id)?.username || null,
      recipientWalletAddress: row.recipient_wallet_address,
      rewardAmountRaw: row.reward_amount_raw,
      rewardTokenDecimals: row.reward_token_decimals,
      splitLockedAt:
        collaborationMap.get(row.collaboration_id)?.split_locked_at || null,
      status: row.status,
      title:
        collaborationMap.get(row.collaboration_id)?.title ||
        "Collaboration payout"
    }));
  };

  const sendAllocation = async (allocation) => {
    if (!supabase || !publicClient || !walletClient || !payoutAccount) {
      return;
    }

    const coinAddress = normalizeAddress(allocation.coinAddress);
    const rewardAmountRaw = BigInt(String(allocation.rewardAmountRaw || 0));
    const currentWalletAddress = normalizeAddress(
      allocation.currentWalletAddress
    );
    const storedWalletAddress = normalizeAddress(
      allocation.recipientWalletAddress
    );
    const recipientWalletAddress = currentWalletAddress || storedWalletAddress;

    if (allocation.payoutsPaused) {
      return;
    }

    if (allocation.launchStatus !== "launched") {
      await markAllocationFailed(
        allocation,
        "Collaboration coin is not live yet."
      );
      return;
    }

    if (!allocation.splitLockedAt) {
      await markAllocationFailed(
        allocation,
        "Collaboration terms are not locked."
      );
      return;
    }

    if (!recipientWalletAddress) {
      await markAllocationFailed(
        allocation,
        "Recipient wallet address is missing."
      );
      return;
    }

    if (currentWalletAddress && currentWalletAddress !== storedWalletAddress) {
      await supabase
        .from("collaboration_earning_allocations")
        .update({
          recipient_wallet_address: currentWalletAddress
        })
        .eq("id", allocation.id);
    }

    if (!coinAddress) {
      await markAllocationFailed(
        allocation,
        "Reward token address is invalid."
      );
      return;
    }

    if (rewardAmountRaw <= 0n) {
      await markAllocationFailed(allocation, "Reward amount is invalid.");
      return;
    }

    const payoutBalance = await publicClient.readContract({
      abi: erc20Abi,
      address: coinAddress,
      args: [payoutWalletAddress],
      functionName: "balanceOf"
    });

    if (payoutBalance < rewardAmountRaw) {
      await markAllocationFailed(
        allocation,
        `Payout wallet balance is too low for ${allocation.coinSymbol}.`
      );
      return;
    }

    try {
      const txHash = await walletClient.writeContract({
        abi: erc20Abi,
        account: payoutAccount,
        address: coinAddress,
        args: [recipientWalletAddress, rewardAmountRaw],
        functionName: "transfer"
      });

      await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 120_000
      });

      const notificationId = await createNotification(
        {
          body: `You received ${allocation.amount} ${allocation.coinSymbol} from "${allocation.title}".`,
          data: {
            amount: allocation.amount,
            coinAddress,
            coinSymbol: allocation.coinSymbol,
            collaborationId: allocation.collaborationId,
            txHash
          },
          recipientId: allocation.profileId,
          targetKey: `/coins/${coinAddress}`,
          title: "Collaboration payout sent"
        },
        supabase
      );

      if (
        allocation.ownerProfileId &&
        allocation.ownerProfileId !== allocation.profileId
      ) {
        await createNotification(
          {
            body: `${getRecipientLabel(allocation)} received ${allocation.amount} ${allocation.coinSymbol} from "${allocation.title}".`,
            data: {
              amount: allocation.amount,
              coinAddress,
              coinSymbol: allocation.coinSymbol,
              collaborationId: allocation.collaborationId,
              recipientProfileId: allocation.profileId,
              status: "paid",
              txHash
            },
            recipientId: allocation.ownerProfileId,
            targetKey: `/coins/${coinAddress}`,
            title: "Collaboration payout delivered"
          },
          supabase
        );
      }

      const { error } = await supabase
        .from("collaboration_earning_allocations")
        .update({
          error_message: null,
          notification_id: notificationId,
          payout_attempted_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          status: "paid",
          tx_hash: txHash
        })
        .eq("id", allocation.id);

      if (error) {
        throw error;
      }
    } catch (error) {
      await markAllocationFailed(
        allocation,
        error instanceof Error ? error.message : "Failed to send payout."
      );
    }
  };

  const dispatchPayouts = async () => {
    if (!payoutEnabled || !supabase || isDispatching) {
      return;
    }

    isDispatching = true;

    try {
      const allocations = await listPendingAllocations();

      for (const allocation of allocations) {
        const lastAttemptTime = allocation.payoutAttemptedAt
          ? new Date(allocation.payoutAttemptedAt).getTime()
          : 0;

        if (
          allocation.status === "failed" &&
          Date.now() - lastAttemptTime < 60_000
        ) {
          continue;
        }

        await sendAllocation(allocation);
      }
    } finally {
      isDispatching = false;
    }
  };

  const start = () => {
    if (!payoutEnabled || payoutInterval) {
      return;
    }

    void dispatchPayouts();
    payoutInterval = setInterval(() => {
      void dispatchPayouts();
    }, 20_000);
  };

  const handleApiRequest = async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://localhost");

    if (!requestUrl.pathname.startsWith("/api/collaboration/")) {
      return false;
    }

    if (requestUrl.pathname === "/api/collaboration/config") {
      jsonResponse(response, 200, {
        enabled: runtimeEnabled,
        payoutEnabled,
        payoutWalletAddress
      });
      return true;
    }

    jsonResponse(response, 404, { error: "Collaboration route not found." });
    return true;
  };

  return {
    handleApiRequest,
    payoutEnabled,
    payoutWalletAddress,
    start
  };
};
