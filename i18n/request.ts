import { readFileSync } from "fs";
import { join } from "path";
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function loadMessages(locale: Locale): Record<string, unknown> {
  // Read from disk so message JSON edits are never stuck behind Turbopack import cache.
  const filePath = join(process.cwd(), "messages", `${locale}.json`);
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;

  const messages = loadMessages(locale);
  const fallbackMessages = locale === "ar" ? messages : loadMessages("ar");

  return {
    locale,
    messages,
    getMessageFallback: ({ namespace, key }) => {
      const path = [namespace, key].filter(Boolean).join(".");
      const fromAr = getByPath(fallbackMessages, path);
      if (typeof fromAr === "string") return fromAr;
      return path;
    },
  };
});
