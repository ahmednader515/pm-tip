import { cache } from "react";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import {
  DEFAULT_QUESTION_BANK_SETTINGS,
  QUESTION_BANK_SETTINGS_ID,
  type QuestionBankSettingsContent,
} from "@/lib/question-bank-settings";

function toQuestionBankSettings(row: {
  displayName: string;
  displayNameEn?: string | null;
}): QuestionBankSettingsContent {
  return {
    displayName: row.displayName.trim() || DEFAULT_QUESTION_BANK_SETTINGS.displayName,
    displayNameEn: (row.displayNameEn ?? "").trim(),
  };
}

export function revalidateQuestionBankPaths() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/question-bank");
}

export async function getQuestionBankSettings(): Promise<QuestionBankSettingsContent> {
  noStore();

  const row = await db.questionBankSettings.findUnique({
    where: { id: QUESTION_BANK_SETTINGS_ID },
  });

  if (!row) {
    await db.questionBankSettings.create({
      data: {
        id: QUESTION_BANK_SETTINGS_ID,
        displayName: DEFAULT_QUESTION_BANK_SETTINGS.displayName,
        displayNameEn: null,
      },
    });
    return DEFAULT_QUESTION_BANK_SETTINGS;
  }

  return toQuestionBankSettings(row);
}

export const getCachedQuestionBankSettings = cache(getQuestionBankSettings);

export async function updateQuestionBankSettings(
  partial: Partial<QuestionBankSettingsContent>
): Promise<QuestionBankSettingsContent> {
  const current = await getQuestionBankSettings();
  const merged: QuestionBankSettingsContent = {
    displayName: partial.displayName ?? current.displayName,
    displayNameEn:
      partial.displayNameEn !== undefined ? partial.displayNameEn : current.displayNameEn,
  };

  const row = await db.questionBankSettings.upsert({
    where: { id: QUESTION_BANK_SETTINGS_ID },
    create: {
      id: QUESTION_BANK_SETTINGS_ID,
      displayName: merged.displayName,
      displayNameEn: merged.displayNameEn || null,
    },
    update: {
      displayName: merged.displayName,
      displayNameEn: merged.displayNameEn || null,
    },
  });

  const content = toQuestionBankSettings(row);
  revalidateQuestionBankPaths();
  return content;
}
