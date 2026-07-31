import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import ar from "../messages/ar.json";
import en from "../messages/en.json";

const catalogs: Record<Locale, Record<string, unknown>> = {
  ar: ar as Record<string, unknown>,
  en: en as Record<string, unknown>,
};

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

  const messages = catalogs[locale] ?? catalogs[defaultLocale];
  const fallbackMessages = catalogs.ar;

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
