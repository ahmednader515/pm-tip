import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { hasCourseAccess } from "@/lib/course-access";
import { parseCorrectAnswer, parseQuizOptions } from "@/lib/utils";

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
                optionsEn: true,
                explanation: true,
                explanationEn: true,
            },
        });

        if (!question) {
            return new NextResponse("Question not found", { status: 404 });
        }

        const type = question.type;
        let displayAnswer: string;
        let displayAnswerEn: string | null = null;

        if (type === "MULTIPLE_CHOICE") {
            const arr = parseCorrectAnswer(question.correctAnswer);
            const arOpts = parseQuizOptions(question.options);
            const enOpts = parseQuizOptions(question.optionsEn);
            displayAnswer = arr.join("، ");
            const enArr = arr.map((opt) => {
                const idx = arOpts.findIndex((o) => o.trim() === opt.trim());
                const en = idx >= 0 ? enOpts[idx] : "";
                return en?.trim() ? en : opt;
            });
            displayAnswerEn = enArr.some((v, i) => v !== arr[i]) ? enArr.join(", ") : null;
        } else if (type === "TRUE_FALSE") {
            // Return raw "true"/"false" so the client can localize with common.true/false
            displayAnswer = question.correctAnswer ?? "";
            displayAnswerEn = null;
        } else {
            displayAnswer = question.correctAnswer ?? "";
        }

        return NextResponse.json({
            type,
            correctAnswer: displayAnswer,
            correctAnswerEn: displayAnswerEn,
            correctAnswerRaw: question.correctAnswer,
            explanation: question.explanation?.trim() || null,
            explanationEn: question.explanationEn?.trim() || null,
        });
    } catch (error) {
        console.error("[QUIZ_CORRECT_ANSWER]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
