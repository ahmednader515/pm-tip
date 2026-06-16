import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-2.0-flash-lite";

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

export function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

function createGenAI() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenerativeAI(apiKey);
}

export function getGeminiModel() {
  return createGenAI().getGenerativeModel({ model: getGeminiModelName() });
}

export function getGeminiModelWithConfig(options: {
  systemInstruction: string;
}) {
  return createGenAI().getGenerativeModel({
    model: getGeminiModelName(),
    systemInstruction: {
      parts: [{ text: options.systemInstruction }],
    },
  });
}
