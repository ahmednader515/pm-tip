/**
 * Student balance UI: Fawaterak gateway vs manual transfer instructions.
 * Set NEXT_PUBLIC_SHOW_FAWATERAK_GATEWAY=true in production when the gateway should appear.
 */
export const SHOW_FAWATERAK_GATEWAY =
  process.env.NEXT_PUBLIC_SHOW_FAWATERAK_GATEWAY === "true";

export const MANUAL_VODAFONE_CASH_NUMBER =
  process.env.NEXT_PUBLIC_MANUAL_VODAFONE_CASH_NUMBER?.trim() ?? "";

export const MANUAL_INSTAPAY_NUMBER =
  process.env.NEXT_PUBLIC_MANUAL_INSTAPAY_NUMBER?.trim() ?? "";
