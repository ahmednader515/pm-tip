import type { Locale } from "@/i18n/config";

export function localizedField<T extends Record<string, unknown>>(
  record: T,
  field: string,
  locale: Locale
): string {
  const base = record[field];
  if (locale === "en") {
    const en = record[`${field}En`];
    if (typeof en === "string" && en.trim()) return en;
  }
  return typeof base === "string" ? base : "";
}

export type LocaleText = { ar: string; en: string };

export function localizedText(value: string | LocaleText | null | undefined, locale: Locale): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (locale === "en" && value.en?.trim()) return value.en;
  return value.ar || value.en || "";
}

export function toLocaleText(value: unknown): LocaleText {
  if (value && typeof value === "object" && "ar" in (value as object)) {
    const v = value as LocaleText;
    return { ar: v.ar ?? "", en: v.en ?? "" };
  }
  if (typeof value === "string") return { ar: value, en: "" };
  return { ar: "", en: "" };
}
