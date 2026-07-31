"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setUserLocale } from "@/app/actions/locale";
import type { Locale } from "@/i18n/config";
import { Languages } from "lucide-react";

export function LanguageSwitcher({ variant = "outline" }: { variant?: "outline" | "ghost" | "default" }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const nextLocale: Locale = locale === "ar" ? "en" : "ar";

  const onSwitch = () => {
    startTransition(async () => {
      await setUserLocale(nextLocale);
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      onClick={onSwitch}
      disabled={isPending}
      className="gap-1.5"
      aria-label={t("switchLanguage")}
    >
      <Languages className="h-4 w-4" />
      <span>{nextLocale === "en" ? t("english") : t("arabic")}</span>
    </Button>
  );
}
