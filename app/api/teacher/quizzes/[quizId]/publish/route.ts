import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ quizId: string }> }
) {
    try {
        const { userId, user } = await auth();
        const resolvedParams = await params;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { isPublished } = await req.json();

        if (user?.role !== "TEACHER" && user?.role !== "ADMIN") {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const quiz = await db.quiz.findFirst({
            where: { id: resolvedParams.quizId },
        });

        if (!quiz) {
            return new NextResponse("Quiz not found", { status: 404 });
        }

        const updatedQuiz = await db.quiz.update({
            where: {
                id: resolvedParams.quizId
            },
            data: {
                isPublished
            }
        });

        return NextResponse.json(updatedQuiz);
    } catch (error) {
        console.log("[QUIZ_PUBLISH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
} 