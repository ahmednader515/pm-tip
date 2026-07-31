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

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default;
  const fallbackMessages =
    locale === "ar"
      ? messages
      : (await import(`../messages/ar.json`)).default;

  return {
    locale,
    messages,
    getMessageFallback: ({ namespace, key }) => {
      const path = [namespace, key].filter(Boolean).join(".");
      const fromAr = getByPath(fallbackMessages as Record<string, unknown>, path);
      if (typeof fromAr === "string") return fromAr;
      return path;
    },
  };
});
