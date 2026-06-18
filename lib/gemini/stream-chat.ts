import { getGeminiModelWithConfig } from "@/lib/gemini/client";
import { getGeminiRetryDelayMs } from "@/lib/gemini/errors";
import {
  buildQuestionBankSystemInstruction,
  fetchRelevantQuestionContext,
} from "@/lib/question-bank-context";
import {
  buildUserParts,
  toGeminiHistory,
  type ChatAttachment,
  type ChatHistoryMessage,
} from "@/lib/gemini/multimodal";

const MAX_HISTORY_TURNS = 20;

export type StreamQuestionBankChatInput = {
  message: string;
  attachments?: ChatAttachment[];
  history?: ChatHistoryMessage[];
};

function trimHistory(history: ChatHistoryMessage[]): ChatHistoryMessage[] {
  return history.slice(-MAX_HISTORY_TURNS);
}

async function* streamOnce({
  message,
  attachments = [],
  history = [],
}: StreamQuestionBankChatInput): AsyncGenerator<string> {
  const trimmedHistory = trimHistory(history);
  const questionContext = await fetchRelevantQuestionContext(
    message,
    trimmedHistory
  );
  const systemInstruction = buildQuestionBankSystemInstruction(questionContext);

  const model = getGeminiModelWithConfig({ systemInstruction });
  const chat = model.startChat({
    history: toGeminiHistory(trimmedHistory),
  });

  const result = await chat.sendMessageStream(
    buildUserParts(message, attachments)
  );

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

export async function* streamQuestionBankChat(
  input: StreamQuestionBankChatInput
): AsyncGenerator<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      yield* streamOnce(input);
      return;
    } catch (error) {
      lastError = error;
      const delay = getGeminiRetryDelayMs(error);
      if (!delay || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export type { ChatAttachment, ChatHistoryMessage };
