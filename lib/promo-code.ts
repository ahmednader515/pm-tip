/** Final price after percentage discount (2 decimal places). */
export function priceAfterDiscountPercent(
  coursePrice: number | null | undefined,
  discountPercent: number
): number {
  const price = Math.max(0, coursePrice ?? 0);
  const d = Math.min(100, Math.max(0, Math.round(discountPercent)));
  const raw = price * (1 - d / 100);
  return Math.round(raw * 100) / 100;
}

export function clampDiscountPercent(value: unknown, fallback = 100): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}
