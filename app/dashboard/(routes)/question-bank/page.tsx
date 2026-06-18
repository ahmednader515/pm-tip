"use client";

import { GeminiChat } from "./_components/gemini-chat";
import { useQuestionBankSettings } from "@/components/question-bank-settings-provider";

export default function QuestionBankPage() {
  const { displayName } = useQuestionBankSettings();

  return (
    <div className="-m-0">
      <GeminiChat displayName={displayName} />
    </div>
  );
}
