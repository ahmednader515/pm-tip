export function isGeminiQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const err = error as { status?: number; message?: string };
  const message = err.message ?? String(error);

  return (
    err.status === 429 ||
    message.includes("429") ||
    message.includes("Too Many Requests") ||
    message.includes("quota") ||
    message.includes("Quota exceeded") ||
    message.includes("RESOURCE_EXHAUSTED")
  );
}

export function getGeminiRetryDelayMs(error: unknown): number | null {
  if (!isGeminiQuotaError(error)) return null;

  const message =
    error instanceof Error ? error.message : String(error ?? "");
  const match = message.match(/retry in ([\d.]+)s/i);
  if (!match) return null;

  const seconds = Number.parseFloat(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  return Math.min(Math.ceil(seconds * 1000), 60_000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 2
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = getGeminiRetryDelayMs(error);
      if (!delay || attempt >= maxAttempts) throw error;
      await sleep(delay);
    }
  }

  throw lastError;
}
