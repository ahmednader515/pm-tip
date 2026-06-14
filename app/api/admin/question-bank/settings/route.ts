import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getQuestionBankSettings,
  updateQuestionBankSettings,
} from "@/lib/question-bank-settings-db";
import { parseQuestionBankSettingsUpdateBody } from "@/lib/question-bank-settings";

export async function GET() {
  try {
    const { userId, user } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });
    if (user?.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const settings = await getQuestionBankSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("[ADMIN_QUESTION_BANK_SETTINGS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId, user } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });
    if (user?.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const body = await req.json();
    const { data, error } = parseQuestionBankSettingsUpdateBody(body);
    if (error) return new NextResponse(error, { status: 400 });
    if (Object.keys(data).length === 0) {
      return new NextResponse("No fields to update", { status: 400 });
    }

    const settings = await updateQuestionBankSettings(data);
    return NextResponse.json(settings, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[ADMIN_QUESTION_BANK_SETTINGS_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
