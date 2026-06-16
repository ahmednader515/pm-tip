import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGeminiApiKey } from "@/lib/gemini/client";
import {
  runQuestionBankChat,
  type ChatHistoryMessage,
} from "@/lib/gemini/question-bank-agent";
import { isGeminiQuotaError } from "@/lib/gemini/errors";
import { NextResponse } from "next/server";

function parseHistory(body: unknown): ChatHistoryMessage[] {
  if (!body || typeof body !== "object" || !("history" in body)) {
    return [];
  }

  const raw = (body as { history: unknown }).history;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (item): item is ChatHistoryMessage =>
        typeof item === "object" &&
        item !== null &&
        "role" in item &&
        "content" in item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0
    )
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }));
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!getGeminiApiKey()) {
      return NextResponse.json(
        {
          message:
            "خدمة الذكاء الاصطناعي غير مفعّلة حالياً. يرجى المحاولة لاحقاً.",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return new NextResponse("Message is required", { status: 400 });
    }

    const history = parseHistory(body);
    const reply = await runQuestionBankChat(message, history);

    return NextResponse.json({ message: reply });
  } catch (error) {
    console.error("[QUESTION_BANK_CHAT]", error);

    if (isGeminiQuotaError(error)) {
      return NextResponse.json(
        {
          message:
            "تم تجاوز حد استخدام خدمة الذكاء الاصطناعي مؤقتاً. يرجى الانتظار دقيقة والمحاولة مرة أخرى.",
        },
        { status: 429 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "GEMINI_API_KEY is not configured"
    ) {
      return NextResponse.json(
        {
          message:
            "خدمة الذكاء الاصطناعي غير مفعّلة حالياً. يرجى المحاولة لاحقاً.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        message: "حدث خطأ أثناء المعالجة. يرجى المحاولة مرة أخرى.",
      },
      { status: 500 }
    );
  }
}
