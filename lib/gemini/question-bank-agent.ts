import { type Content } from "@google/generative-ai";
import { getGeminiModelWithConfig } from "@/lib/gemini/client";
import { withGeminiRetry } from "@/lib/gemini/errors";
import {
  buildQuestionBankSystemInstruction,
  fetchRelevantQuestionContext,
  type ChatHistoryMessage,
} from "@/lib/question-bank-context";

export type { ChatHistoryMessage };

const MAX_HISTORY_TURNS = 10;

function trimHistory(history: ChatHistoryMessage[]): ChatHistoryMessage[] {
  return history.slice(-MAX_HISTORY_TURNS);
}

function toGeminiHistory(history: ChatHistoryMessage[]): Content[] {
  return trimHistory(history).map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
}

function getResponseText(response: {
  text?: () => string;
}): string {
  try {
    return response.text()?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function runQuestionBankChat(
  message: string,
  history: ChatHistoryMessage[] = []
): Promise<string> {
  return withGeminiRetry(async () => {
    const questionContext = await fetchRelevantQuestionContext(message, history);
    const systemInstruction = buildQuestionBankSystemInstruction(questionContext);

    const model = getGeminiModelWithConfig({ systemInstruction });
    const chat = model.startChat({
      history: toGeminiHistory(history),
    });

    const result = await chat.sendMessage(message);
    const text = getResponseText(result.response);

    if (text) return text;

    return "عذراً، لم أتمكن من إعداد إجابة. يرجى إعادة صياغة سؤالك والمحاولة مرة أخرى.";
  });
}

/** @deprecated Use runQuestionBankChat */
export const runQuestionBankAgent = runQuestionBankChat;
