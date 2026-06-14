"use client";

import { createContext, useContext } from "react";
import {
  DEFAULT_QUESTION_BANK_SETTINGS,
  type QuestionBankSettingsContent,
} from "@/lib/question-bank-settings";

const QuestionBankSettingsContext = createContext<QuestionBankSettingsContent>(
  DEFAULT_QUESTION_BANK_SETTINGS
);

export function QuestionBankSettingsProvider({
  settings,
  children,
}: {
  settings: QuestionBankSettingsContent;
  children: React.ReactNode;
}) {
  return (
    <QuestionBankSettingsContext.Provider value={settings}>
      {children}
    </QuestionBankSettingsContext.Provider>
  );
}

export function useQuestionBankSettings() {
  return useContext(QuestionBankSettingsContext);
}
