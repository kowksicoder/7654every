import { IPFS_GATEWAY, STORAGE_NODE_URL } from "@/data/constants";

const decodeBase64Url = (value: string) => {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedValue = normalizedValue.padEnd(
    Math.ceil(normalizedValue.length / 4) * 4,
    "="
  );

  try {
    if (typeof atob === "function") {
      return atob(paddedValue);
    }
  } catch {
    // Ignore browser decode failures and fall back.
  }

  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(paddedValue, "base64").toString("utf8");
    }
  } catch {
    // Ignore non-browser/non-node decode failures.
  }

  return null;
};

const unwrapChoiceCdnUrl = (value: string) => {
  try {
    const parsed = new URL(value);

    if (!parsed.hostname.endsWith("choicecdn.com")) {
      return value;
    }

    const encodedTarget = parsed.pathname.split("/").filter(Boolean).pop();

    if (!encodedTarget) {
      return value;
    }

    const decodedTarget = decodeBase64Url(encodedTarget);

    if (!decodedTarget || !/^https?:\/\//i.test(decodedTarget)) {
      return value;
    }

    return decodedTarget;
  } catch {
    return value;
  }
};

const sanitizeDStorageUrl = (url?: string): string => {
  if (!url) {
    return "";
  }

  const ipfsGateway = `${IPFS_GATEWAY}/`;
  const normalizedUrl = unwrapChoiceCdnUrl(url);

  if (/^Qm[1-9A-Za-z]{44}/.test(normalizedUrl)) {
    return `${ipfsGateway}${normalizedUrl}`;
  }

  return normalizedUrl
    .replace("https://magic.decentralized-content.com/ipfs/", ipfsGateway)
    .replace("https://ipfs.io/ipfs/", ipfsGateway)
    .replace("ipfs://ipfs/", ipfsGateway)
    .replace("ipfs://", ipfsGateway)
    .replace("lens://", `${STORAGE_NODE_URL}/`)
    .replace("ar://", "https://gateway.arweave.net/");
};

export default sanitizeDStorageUrl;
