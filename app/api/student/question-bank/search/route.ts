import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchQuestions } from "@/lib/question-bank";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query : "";

    if (!query.trim()) {
      return NextResponse.json({ results: [], total: 0 });
    }

    const { results, total } = await searchQuestions(query);

    return NextResponse.json({ results, total });
  } catch (error) {
    console.error("[QUESTION_BANK_SEARCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
