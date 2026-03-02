import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { hasCourseAccess } from "@/lib/course-access";
import { parseCorrectAnswer } from "@/lib/utils";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
    try {
        const { userId } = await auth();
        const resolvedParams = await params;
        const { searchParams } = new URL(req.url);
        const questionId = searchParams.get("questionId");

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const access = await hasCourseAccess(userId, resolvedParams.courseId);
        if (!access) {
            return new NextResponse("Course access required", { status: 403 });
        }

        if (!questionId) {
            return new NextResponse("Missing questionId", { status: 400 });
        }

        const question = await db.question.findFirst({
            where: {
                id: questionId,
                quizId: resolvedParams.quizId,
                quiz: {
                    courseId: resolvedParams.courseId,
                    isPublished: true,
                },
            },
            select: {
                type: true,
                correctAnswer: true,
                options: true,
                explanation: true,
            },
        });

        if (!question) {
            return new NextResponse("Question not found", { status: 404 });
        }

        const type = question.type;
        let displayAnswer: string;
        if (type === "MULTIPLE_CHOICE") {
            const arr = parseCorrectAnswer(question.correctAnswer);
            displayAnswer = arr.join("، ");
        } else if (type === "TRUE_FALSE") {
            displayAnswer = question.correctAnswer === "true" ? "صح" : "خطأ";
        } else {
            displayAnswer = question.correctAnswer ?? "";
        }

        return NextResponse.json({
            type,
            correctAnswer: displayAnswer,
            correctAnswerRaw: question.correctAnswer,
            explanation: question.explanation?.trim() || null,
        });
    } catch (error) {
        console.error("[QUIZ_CORRECT_ANSWER]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
