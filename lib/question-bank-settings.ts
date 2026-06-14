export const QUESTION_BANK_SETTINGS_ID = "default";

export const DEFAULT_QUESTION_BANK_DISPLAY_NAME = "بنك الأسئلة";

export type QuestionBankSettingsContent = {
  displayName: string;
};

export const DEFAULT_QUESTION_BANK_SETTINGS: QuestionBankSettingsContent = {
  displayName: DEFAULT_QUESTION_BANK_DISPLAY_NAME,
};

export function parseQuestionBankSettingsUpdateBody(
  body: unknown
): { data: Partial<QuestionBankSettingsContent>; error?: string } {
  if (!body || typeof body !== "object") {
    return { data: {}, error: "Invalid request body" };
  }

  const data: Partial<QuestionBankSettingsContent> = {};
  const record = body as Record<string, unknown>;

  if ("displayName" in record) {
    if (typeof record.displayName !== "string") {
      return { data: {}, error: "displayName must be a string" };
    }
    const trimmed = record.displayName.trim();
    if (trimmed.length === 0) {
      return { data: {}, error: "displayName cannot be empty" };
    }
    if (trimmed.length > 100) {
      return { data: {}, error: "displayName is too long (max 100 characters)" };
    }
    data.displayName = trimmed;
  }

  return { data };
}

export function getWelcomeMessage(displayName: string): string {
  return `مرحباً! ابحث في ${displayName} بكتابة كلمات مفتاحية متعلقة بأي سؤال. سأعرض لك السؤال كاملاً مع الخيارات والإجابة الصحيحة والشرح.`;
}
