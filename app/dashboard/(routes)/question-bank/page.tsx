"use client";

import { GeminiChat } from "./_components/gemini-chat";
import { useQuestionBankSettings } from "@/components/question-bank-settings-provider";
import { useLocale } from "next-intl";
import { localizedField } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

export default function QuestionBankPage() {
  const questionBankSettings = useQuestionBankSettings();
  const locale = useLocale() as Locale;
  const displayName = localizedField(questionBankSettings as unknown as Record<string, unknown>, "displayName", locale);

  return (
    <div className="-m-0">
      <GeminiChat displayName={displayName} />
    </div>
  );
}
