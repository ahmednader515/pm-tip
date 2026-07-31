"use client";

import { createContext, useContext, useEffect } from "react";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/config";
import { getDir } from "@/i18n/config";

interface RTLContextType {
  isRTL: boolean;
  locale: Locale;
}

const RTLContext = createContext<RTLContextType>({
  isRTL: true,
  locale: "ar",
});

export const useRTL = () => useContext(RTLContext);

export const RTLProvider = ({ children }: { children: React.ReactNode }) => {
  const locale = useLocale() as Locale;
  const isRTL = locale === "ar";

  useEffect(() => {
    document.documentElement.dir = getDir(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <RTLContext.Provider value={{ isRTL, locale }}>
      {children}
    </RTLContext.Provider>
  );
};
