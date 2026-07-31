"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

type LegalPageProps = {
  title: string;
  children: ReactNode;
  lastUpdated?: string;
};

export function LegalPage({ title, children, lastUpdated }: LegalPageProps) {
  const t = useTranslations("legal");

  return (
    <div className="container mx-auto px-4 max-w-3xl">
      <h1 className="text-3xl font-bold text-brand mb-2">{title}</h1>
      {lastUpdated && (
        <p className="text-muted-foreground text-sm mb-8">
          {t("lastUpdated", { date: lastUpdated })}
        </p>
      )}
      <div className="prose prose-sm max-w-none dark:prose-invert space-y-6 text-foreground">
        {children}
      </div>
    </div>
  );
}
