import { NextResponse } from "next/server";
import { getQuestionBankSettings } from "@/lib/question-bank-settings-db";

export async function GET() {
  try {
    const settings = await getQuestionBankSettings();
    return NextResponse.json(settings, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[QUESTION_BANK_SETTINGS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
