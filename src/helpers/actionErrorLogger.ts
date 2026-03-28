type ActionErrorContext = Record<string, unknown>;

const normalizeValue = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      cause: normalizeValue(value.cause),
      message: value.message,
      name: value.name,
      stack: value.stack
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, normalizeValue(entry)])
    );
  }

  return value;
};

export const logActionError = (
  action: string,
  error: unknown,
  context?: ActionErrorContext
) => {
  const payload = {
    action,
    at: new Date().toISOString(),
    context: normalizeValue(context),
    error: normalizeValue(error)
  };

  if (typeof window !== "undefined") {
    (
      window as typeof window & {
        __EVERY1_LAST_ACTION_ERROR__?: typeof payload;
      }
    ).__EVERY1_LAST_ACTION_ERROR__ = payload;
  }

  console.error(`[Every1] ${action} failed`, payload);

  return payload;
};
