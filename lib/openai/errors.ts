import OpenAI from "openai";

export function isOpenAIQuotaError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return error.status === 429;
  }

  if (!error || typeof error !== "object") return false;

  const err = error as { status?: number; message?: string };
  const message = err.message ?? String(error);

  return (
    err.status === 429 ||
    message.includes("429") ||
    message.includes("rate_limit") ||
    message.includes("Rate limit") ||
    message.includes("insufficient_quota")
  );
}

export function getOpenAIRetryDelayMs(error: unknown): number | null {
  if (!isOpenAIQuotaError(error)) return null;

  if (error instanceof OpenAI.APIError) {
    const retryAfter = error.headers?.["retry-after"];
    if (retryAfter) {
      const seconds = Number.parseFloat(String(retryAfter));
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.min(Math.ceil(seconds * 1000), 60_000);
      }
    }
  }

  return 1000;
}
