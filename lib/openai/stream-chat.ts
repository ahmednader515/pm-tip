import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { getOpenAIClient, getOpenAIModelName } from "@/lib/openai/client";
import { getOpenAIRetryDelayMs } from "@/lib/openai/errors";
import {
  buildQuestionBankSystemInstruction,
  fetchQuestionBankContext,
} from "@/lib/question-bank-context";
import {
  isImageMimeType,
  normalizeBase64,
  type ChatAttachment,
  type ChatHistoryMessage,
} from "@/lib/chat/multimodal";

const MAX_HISTORY_TURNS = 20;

export type StreamQuestionBankChatInput = {
  message: string;
  attachments?: ChatAttachment[];
  history?: ChatHistoryMessage[];
};

function trimHistory(history: ChatHistoryMessage[]): ChatHistoryMessage[] {
  return history.slice(-MAX_HISTORY_TURNS);
}

function buildUserContent(
  text: string,
  attachments: ChatAttachment[] = []
): string | ChatCompletionContentPart[] {
  const parts: ChatCompletionContentPart[] = [];

  for (const attachment of attachments) {
    const data = normalizeBase64(attachment.data);

    if (isImageMimeType(attachment.mimeType)) {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${attachment.mimeType};base64,${data}`,
        },
      });
      continue;
    }

    if (attachment.mimeType === "application/pdf") {
      parts.push({
        type: "file",
        file: {
          filename: attachment.name ?? "document.pdf",
          file_data: `data:application/pdf;base64,${data}`,
        },
      } as ChatCompletionContentPart);
    }
  }

  const trimmedText = text.trim();
  if (trimmedText) {
    parts.push({ type: "text", text: trimmedText });
  } else if (attachments.length > 0) {
    parts.push({ type: "text", text: "Please analyze the attached file(s)." });
  }

  if (parts.length === 1 && parts[0].type === "text") {
    return parts[0].text;
  }

  return parts;
}

function toOpenAIHistory(
  history: ChatHistoryMessage[]
): ChatCompletionMessageParam[] {
  return history.map((message) => {
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content,
      };
    }

    return {
      role: "user",
      content: buildUserContent(message.content, message.attachments ?? []),
    };
  });
}

async function* streamOnce({
  message,
  attachments = [],
  history = [],
}: StreamQuestionBankChatInput): AsyncGenerator<string> {
  const trimmedHistory = trimHistory(history);
  const questionContext = await fetchQuestionBankContext(
    message,
    trimmedHistory
  );
  const systemInstruction = buildQuestionBankSystemInstruction(questionContext);

  const openai = getOpenAIClient();
  const stream = await openai.chat.completions.create({
    model: getOpenAIModelName(),
    stream: true,
    messages: [
      { role: "system", content: systemInstruction },
      ...toOpenAIHistory(trimmedHistory),
      {
        role: "user",
        content: buildUserContent(message, attachments),
      },
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
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
      const delay = getOpenAIRetryDelayMs(error);
      if (!delay || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export type { ChatAttachment, ChatHistoryMessage };
