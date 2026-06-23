import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOpenAIApiKey } from "@/lib/openai/client";
import { isOpenAIQuotaError } from "@/lib/openai/errors";
import {
  validateAttachments,
  type ChatAttachment,
  type ChatHistoryMessage,
} from "@/lib/chat/multimodal";
import { streamQuestionBankChat } from "@/lib/openai/stream-chat";

function parseAttachments(raw: unknown): ChatAttachment[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (item): item is ChatAttachment =>
        typeof item === "object" &&
        item !== null &&
        "mimeType" in item &&
        "data" in item &&
        typeof (item as ChatAttachment).mimeType === "string" &&
        typeof (item as ChatAttachment).data === "string"
    )
    .map((item) => ({
      mimeType: item.mimeType,
      data: item.data,
      name: typeof item.name === "string" ? item.name : undefined,
    }));
}

function parseHistory(raw: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (item): item is ChatHistoryMessage =>
        typeof item === "object" &&
        item !== null &&
        "role" in item &&
        "content" in item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
    )
    .map((item) => ({
      role: item.role,
      content: item.content,
      attachments:
        item.role === "user" ? parseAttachments(item.attachments) : undefined,
    }));
}

function sseEncode(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!getOpenAIApiKey()) {
    return new Response(
      sseEncode({
        type: "error",
        message:
          "خدمة الذكاء الاصطناعي غير مفعّلة حالياً. يرجى المحاولة لاحقاً.",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const message =
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof (body as { message: unknown }).message === "string"
      ? (body as { message: string }).message.trim()
      : "";

  const attachments = parseAttachments(
    typeof body === "object" && body !== null && "attachments" in body
      ? (body as { attachments: unknown }).attachments
      : undefined
  );

  const { valid: validAttachments, error: attachmentError } =
    validateAttachments(attachments);

  if (attachmentError) {
    return new Response(sseEncode({ type: "error", message: attachmentError }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  if (!message && validAttachments.length === 0) {
    return new Response("Message or attachment is required", { status: 400 });
  }

  const history = parseHistory(
    typeof body === "object" && body !== null && "history" in body
      ? (body as { history: unknown }).history
      : undefined
  );

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseEncode(payload)));
      };

      try {
        for await (const chunk of streamQuestionBankChat({
          message,
          attachments: validAttachments,
          history,
        })) {
          send({ type: "chunk", text: chunk });
        }
        send({ type: "done" });
      } catch (error) {
        console.error("[QUESTION_BANK_CHAT]", error);

        let messageText = "حدث خطأ أثناء المعالجة. يرجى المحاولة مرة أخرى.";

        if (isOpenAIQuotaError(error)) {
          messageText =
            "تم تجاوز حد استخدام خدمة الذكاء الاصطناعي مؤقتاً. يرجى الانتظار دقيقة والمحاولة مرة أخرى.";
        } else if (
          error instanceof Error &&
          error.message === "OPENAI_API_KEY is not configured"
        ) {
          messageText =
            "خدمة الذكاء الاصطناعي غير مفعّلة حالياً. يرجى المحاولة لاحقاً.";
        }

        send({ type: "error", message: messageText });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
