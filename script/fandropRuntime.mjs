import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  erc20Abi,
  formatUnits,
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

const readJsonBody = (request) =>
  new Promise((resolve, reject) => {
    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk.toString("utf8");
    });

    request.on("end", () => {
      if (!rawBody.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });

const normalizeAddress = (value) => {
  const trimmed = value?.trim().toLowerCase();
  return trimmed && isAddress(trimmed) ? trimmed : null;
};

const createNotification = async (
  { body, data, recipientId, title, targetKey },
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

export const createFanDropRuntime = ({ rootDir }) => {
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
  const runtimeEnabled = Boolean(supabaseUrl && serviceRoleKey && rpcUrl);
  const payoutAccount =
    payoutPrivateKey && /^0x[a-fA-F0-9]{64}$/.test(payoutPrivateKey)
      ? privateKeyToAccount(payoutPrivateKey)
      : null;
  const settlementEnabled = Boolean(runtimeEnabled && payoutAccount);
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
    settlementEnabled && payoutAccount
      ? createWalletClient({
          account: payoutAccount,
          chain: base,
          transport: http(rpcUrl, { batch: { batchSize: 20 } })
        })
      : null;
  let settlementInterval = null;
  let isSettling = false;

  const loadRewardPool = async (missionId) => {
    if (!supabase) {
      throw new Error("FanDrop runtime is not configured.");
    }

    const { data, error } = await supabase
      .from("fandrop_reward_pools")
      .select(
        `
          mission_id,
          creator_profile_id,
          reward_token_address,
          reward_token_symbol,
          reward_token_decimals,
          reward_pool_amount,
          reward_pool_amount_raw,
          winner_limit,
          settlement_status,
          funding_tx_hash,
          funded_by_wallet_address,
          funded_at,
          settled_at,
          settlement_started_at,
          last_settlement_attempt_at,
          last_settlement_error,
          missions!inner (
            id,
            slug,
            starts_at,
            title,
            ends_at,
            status
          )
        `
      )
      .eq("mission_id", missionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data || null;
  };

  const verifyFundingTransfer = async ({ missionId, txHash }) => {
    if (!supabase || !publicClient || !payoutWalletAddress) {
      throw new Error("FanDrop runtime is not enabled on this server.");
    }

    const rewardPool = await loadRewardPool(missionId);

    if (!rewardPool) {
      throw new Error("FanDrop reward pool not found.");
    }

    if (rewardPool.funded_at) {
      return {
        alreadyFunded: true,
        funded: true,
        fundedAt: rewardPool.funded_at
      };
    }

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000
    });

    const tokenAddress = normalizeAddress(rewardPool.reward_token_address);

    if (!tokenAddress) {
      throw new Error("Reward token address is invalid.");
    }

    const expectedAmountRaw = BigInt(String(rewardPool.reward_pool_amount_raw));
    let matchedTransfer = null;

    for (const log of receipt.logs) {
      if (normalizeAddress(log.address) !== tokenAddress) {
        continue;
      }

      try {
        const decoded = decodeEventLog({
          abi: erc20Abi,
          data: log.data,
          topics: log.topics
        });

        if (decoded.eventName !== "Transfer") {
          continue;
        }

        const fromAddress = normalizeAddress(decoded.args.from);
        const toAddress = normalizeAddress(decoded.args.to);
        const value = BigInt(decoded.args.value);

        if (toAddress === payoutWalletAddress && value === expectedAmountRaw) {
          matchedTransfer = {
            fromAddress,
            toAddress,
            value
          };
          break;
        }
      } catch {}
    }

    if (!matchedTransfer) {
      throw new Error(
        "We could not verify a matching reward-pool transfer into the payout wallet."
      );
    }

    const fundedAt = new Date().toISOString();
    const { error } = await supabase
      .from("fandrop_reward_pools")
      .update({
        funded_at: fundedAt,
        funded_by_wallet_address: matchedTransfer.fromAddress,
        funding_tx_hash: txHash,
        last_settlement_error: null,
        settlement_status: "funded"
      })
      .eq("mission_id", missionId);

    if (error) {
      throw error;
    }

    return {
      funded: true,
      fundedAt
    };
  };

  const listEligibleRecipients = async (rewardPool) => {
    if (!supabase) {
      return [];
    }

    const campaignSlug = rewardPool.missions.slug.toLowerCase();
    const startsAt = rewardPool.missions.starts_at;
    const endsAt = rewardPool.missions.ends_at;
    const winnerLimit = Number(rewardPool.winner_limit || 0) || null;

    const [
      { data: taskRows, error: taskError },
      { data: participants, error: participantError }
    ] = await Promise.all([
      supabase
        .from("mission_tasks")
        .select("task_key, task_type, target_count, config, position")
        .eq("mission_id", rewardPool.mission_id)
        .order("position", { ascending: true }),
      supabase
        .from("profile_fandrop_participation")
        .select(
          `
              profile_id,
              joined_at,
              profiles!inner (
                wallet_address,
                display_name,
                username
              )
            `
        )
        .eq("campaign_slug", campaignSlug)
        .order("joined_at", { ascending: true })
    ]);

    if (taskError) {
      throw taskError;
    }

    if (participantError) {
      throw participantError;
    }

    const validParticipants = (participants || []).filter((participant) =>
      normalizeAddress(participant.profiles?.wallet_address)
    );
    const participantIds = validParticipants.map(
      (participant) => participant.profile_id
    );
    const referralTask = (taskRows || []).find(
      (task) => task.task_type === "referral"
    );
    const paymentTask = (taskRows || []).find(
      (task) => task.task_type === "payment"
    );
    const referralCounts = new Map();
    const paymentCounts = new Map();

    if (participantIds.length && referralTask) {
      let referralQuery = supabase
        .from("referral_events")
        .select("referrer_id")
        .in("referrer_id", participantIds)
        .in("status", ["completed", "rewarded"]);

      if (startsAt) {
        referralQuery = referralQuery.gte("created_at", startsAt);
      }

      if (endsAt) {
        referralQuery = referralQuery.lte("created_at", endsAt);
      }

      const { data, error } = await referralQuery;

      if (error) {
        throw error;
      }

      for (const row of data || []) {
        referralCounts.set(
          row.referrer_id,
          (referralCounts.get(row.referrer_id) || 0) + 1
        );
      }
    }

    if (participantIds.length && paymentTask) {
      const minimumAmount = Number(paymentTask.config?.minimumAmount || 0);
      let paymentQuery = supabase
        .from("payment_transactions")
        .select("profile_id")
        .in("profile_id", participantIds)
        .eq("status", "succeeded");

      if (minimumAmount > 0) {
        paymentQuery = paymentQuery.gte("amount", minimumAmount);
      }

      if (startsAt) {
        paymentQuery = paymentQuery.gte("created_at", startsAt);
      }

      if (endsAt) {
        paymentQuery = paymentQuery.lte("created_at", endsAt);
      }

      const { data, error } = await paymentQuery;

      if (error) {
        throw error;
      }

      for (const row of data || []) {
        paymentCounts.set(
          row.profile_id,
          (paymentCounts.get(row.profile_id) || 0) + 1
        );
      }
    }

    const eligibleParticipants = validParticipants.filter((participant) => {
      return (taskRows || []).every((task) => {
        const isOptional = Boolean(task.config?.optional);

        if (isOptional) {
          return true;
        }

        if (task.task_type === "referral") {
          return (
            (referralCounts.get(participant.profile_id) || 0) >=
            task.target_count
          );
        }

        if (task.task_type === "payment") {
          return (
            (paymentCounts.get(participant.profile_id) || 0) >=
            task.target_count
          );
        }

        return true;
      });
    });

    const rankedRecipients = eligibleParticipants.map((participant, index) => ({
      displayName: participant.profiles?.display_name || null,
      joinedAt: participant.joined_at,
      profileId: participant.profile_id,
      rank: index + 1,
      username: participant.profiles?.username || null,
      walletAddress: normalizeAddress(participant.profiles?.wallet_address)
    }));

    return winnerLimit
      ? rankedRecipients.slice(0, winnerLimit)
      : rankedRecipients;
  };

  const ensureDistributionRows = async ({ eligibleRecipients, rewardPool }) => {
    if (!supabase) {
      return [];
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("fandrop_reward_distributions")
      .select("*")
      .eq("mission_id", rewardPool.mission_id)
      .order("created_at", { ascending: true });

    if (existingError) {
      throw existingError;
    }

    if (existingRows?.length) {
      return existingRows;
    }

    if (!eligibleRecipients.length) {
      return [];
    }

    const totalAmountRaw = BigInt(String(rewardPool.reward_pool_amount_raw));
    const decimals = Number(rewardPool.reward_token_decimals || 18);
    const baseAmount = totalAmountRaw / BigInt(eligibleRecipients.length);
    const remainder = totalAmountRaw % BigInt(eligibleRecipients.length);

    if (baseAmount <= 0n) {
      throw new Error(
        "Reward pool is too small for the number of eligible recipients."
      );
    }

    const rows = eligibleRecipients.map((recipient, index) => {
      const rewardAmountRaw =
        baseAmount + (BigInt(index) < remainder ? 1n : 0n);
      return {
        mission_id: rewardPool.mission_id,
        recipient_profile_id: recipient.profileId,
        recipient_wallet_address: recipient.walletAddress,
        reward_amount: formatUnits(rewardAmountRaw, decimals),
        reward_amount_raw: rewardAmountRaw.toString(),
        reward_token_address: rewardPool.reward_token_address,
        reward_token_decimals: decimals,
        reward_token_symbol: rewardPool.reward_token_symbol,
        status: "pending"
      };
    });

    const { data, error } = await supabase
      .from("fandrop_reward_distributions")
      .insert(rows)
      .select("*");

    if (error) {
      throw error;
    }

    return data || [];
  };

  const settleRewardPool = async (rewardPool) => {
    if (!supabase || !publicClient || !walletClient || !payoutWalletAddress) {
      return;
    }

    const endedAt = rewardPool.missions.ends_at
      ? new Date(rewardPool.missions.ends_at).getTime()
      : null;

    if (endedAt && endedAt > Date.now()) {
      return;
    }

    const nowIso = new Date().toISOString();
    const { error: markSettlingError } = await supabase
      .from("fandrop_reward_pools")
      .update({
        last_settlement_attempt_at: nowIso,
        last_settlement_error: null,
        settlement_started_at: nowIso,
        settlement_status: "settling"
      })
      .eq("mission_id", rewardPool.mission_id);

    if (markSettlingError) {
      throw markSettlingError;
    }

    const eligibleRecipients = await listEligibleRecipients(rewardPool);
    const distributions = await ensureDistributionRows({
      eligibleRecipients,
      rewardPool
    });

    if (!distributions.length) {
      await supabase
        .from("fandrop_reward_pools")
        .update({
          settled_at: new Date().toISOString(),
          settlement_status: "settled"
        })
        .eq("mission_id", rewardPool.mission_id);
      return;
    }

    const tokenAddress = normalizeAddress(rewardPool.reward_token_address);

    if (!tokenAddress) {
      throw new Error("Reward token address is invalid.");
    }

    const payoutBalance = await publicClient.readContract({
      abi: erc20Abi,
      address: tokenAddress,
      args: [payoutWalletAddress],
      functionName: "balanceOf"
    });

    const outstandingRaw = distributions
      .filter((distribution) => distribution.status !== "sent")
      .reduce(
        (total, distribution) =>
          total + BigInt(String(distribution.reward_amount_raw)),
        0n
      );

    if (payoutBalance < outstandingRaw) {
      throw new Error(
        `Payout wallet balance is too low for ${rewardPool.missions.title}.`
      );
    }

    for (const distribution of distributions) {
      if (distribution.status === "sent") {
        continue;
      }

      const recipientAddress = normalizeAddress(
        distribution.recipient_wallet_address
      );

      if (!recipientAddress) {
        await supabase
          .from("fandrop_reward_distributions")
          .update({
            error_message: "Recipient wallet address is invalid.",
            status: "failed"
          })
          .eq("id", distribution.id);
        continue;
      }

      const amountRaw = BigInt(String(distribution.reward_amount_raw));
      try {
        const txHash = await walletClient.writeContract({
          abi: erc20Abi,
          account: payoutAccount,
          address: tokenAddress,
          args: [recipientAddress, amountRaw],
          functionName: "transfer"
        });

        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 120_000
        });

        const notificationId = await createNotification(
          {
            body: `You received ${distribution.reward_amount} ${distribution.reward_token_symbol}.`,
            data: {
              campaignSlug: rewardPool.missions.slug,
              missionId: rewardPool.mission_id,
              rewardAmount: distribution.reward_amount,
              rewardTokenSymbol: distribution.reward_token_symbol,
              txHash
            },
            recipientId: distribution.recipient_profile_id,
            targetKey: `/fandrop/${rewardPool.missions.slug}`,
            title: `${rewardPool.missions.title} reward sent`
          },
          supabase
        );

        await supabase
          .from("fandrop_reward_distributions")
          .update({
            error_message: null,
            notification_id: notificationId,
            sent_at: new Date().toISOString(),
            status: "sent",
            tx_hash: txHash
          })
          .eq("id", distribution.id);
      } catch (error) {
        await supabase
          .from("fandrop_reward_distributions")
          .update({
            error_message:
              error instanceof Error ? error.message : "Failed to send reward.",
            status: "failed"
          })
          .eq("id", distribution.id);
      }
    }

    const { data: finalRows, error: finalError } = await supabase
      .from("fandrop_reward_distributions")
      .select("status")
      .eq("mission_id", rewardPool.mission_id);

    if (finalError) {
      throw finalError;
    }

    const hasFailed = (finalRows || []).some((row) => row.status === "failed");
    const hasPending = (finalRows || []).some(
      (row) => row.status === "pending"
    );

    await supabase
      .from("fandrop_reward_pools")
      .update({
        last_settlement_error: hasFailed
          ? "Some reward transfers failed."
          : null,
        settled_at: !hasFailed && !hasPending ? new Date().toISOString() : null,
        settlement_status: hasFailed || hasPending ? "failed" : "settled"
      })
      .eq("mission_id", rewardPool.mission_id);
  };

  const dispatchSettlements = async () => {
    if (!settlementEnabled || !supabase || isSettling) {
      return;
    }

    isSettling = true;

    try {
      const { data, error } = await supabase
        .from("fandrop_reward_pools")
        .select(
          `
            mission_id,
            creator_profile_id,
            reward_token_address,
            reward_token_symbol,
            reward_token_decimals,
            reward_pool_amount,
            reward_pool_amount_raw,
            winner_limit,
            settlement_status,
            funding_tx_hash,
            funded_by_wallet_address,
            funded_at,
            settled_at,
            settlement_started_at,
            last_settlement_attempt_at,
            last_settlement_error,
            missions!inner (
              id,
              slug,
              starts_at,
              title,
              ends_at,
              status
            )
          `
        )
        .in("settlement_status", ["funded", "failed"])
        .not("funded_at", "is", null)
        .order("funded_at", { ascending: true })
        .limit(10);

      if (error) {
        throw error;
      }

      for (const rewardPool of data || []) {
        const lastAttemptTime = rewardPool.last_settlement_attempt_at
          ? new Date(rewardPool.last_settlement_attempt_at).getTime()
          : 0;

        if (
          rewardPool.settlement_status === "failed" &&
          Date.now() - lastAttemptTime < 60_000
        ) {
          continue;
        }

        try {
          await settleRewardPool(rewardPool);
        } catch (error) {
          console.error("Failed to settle FanDrop reward pool", error);
          await supabase
            .from("fandrop_reward_pools")
            .update({
              last_settlement_attempt_at: new Date().toISOString(),
              last_settlement_error:
                error instanceof Error ? error.message : "Settlement failed.",
              settlement_status: "failed"
            })
            .eq("mission_id", rewardPool.mission_id);
        }
      }
    } finally {
      isSettling = false;
    }
  };

  const start = () => {
    if (!settlementEnabled || settlementInterval) {
      return;
    }

    void dispatchSettlements();
    settlementInterval = setInterval(() => {
      void dispatchSettlements();
    }, 20_000);
  };

  const handleApiRequest = async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://localhost");

    if (!requestUrl.pathname.startsWith("/api/fandrop/")) {
      return false;
    }

    if (requestUrl.pathname === "/api/fandrop/config") {
      jsonResponse(response, 200, {
        enabled: runtimeEnabled,
        payoutWalletAddress,
        settlementEnabled
      });
      return true;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/api/fandrop/fund/verify"
    ) {
      try {
        const body = await readJsonBody(request);
        const missionId = body?.missionId?.trim();
        const txHash = body?.txHash?.trim();

        if (!missionId || !txHash) {
          jsonResponse(response, 400, {
            error: "missionId and txHash are required."
          });
          return true;
        }

        const result = await verifyFundingTransfer({ missionId, txHash });
        jsonResponse(response, 200, result);
      } catch (error) {
        jsonResponse(response, 500, {
          error:
            error instanceof Error
              ? error.message
              : "Failed to verify FanDrop reward funding."
        });
      }

      return true;
    }

    jsonResponse(response, 404, { error: "FanDrop route not found." });
    return true;
  };

  return {
    handleApiRequest,
    payoutWalletAddress,
    settlementEnabled,
    start
  };
};
