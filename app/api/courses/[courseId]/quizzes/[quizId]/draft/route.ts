import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { hasCourseAccess } from "@/lib/course-access";
import { normalizeRevealedFeedback } from "@/lib/quiz-draft";

function clampQuestionIndex(index: number, questionCount: number): number {
    const max = Math.max(0, questionCount - 1);
    return Math.min(Math.max(0, Math.floor(index)), max);
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
    try {
        const { userId } = await auth();
        const resolvedParams = await params;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const access = await hasCourseAccess(userId, resolvedParams.courseId);
        if (!access) {
            return new NextResponse("Course access required", { status: 403 });
        }

        const draft = await db.quizDraft.findUnique({
            where: {
                userId_quizId: { userId, quizId: resolvedParams.quizId },
            },
        });

        if (!draft) {
            return NextResponse.json({
                answers: [],
                currentQuestionIndex: 0,
                revealedFeedback: {},
            });
        }

        const answers = (draft.answers as { questionId: string; answer: string }[]) || [];
        return NextResponse.json({
            answers,
            currentQuestionIndex: draft.currentQuestionIndex ?? 0,
            revealedFeedback: normalizeRevealedFeedback(draft.revealedFeedback),
            updatedAt: draft.updatedAt,
        });
    } catch (error) {
        console.log("[QUIZ_DRAFT_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
    try {
        const { userId } = await auth();
        const resolvedParams = await params;
        const body = await req.json();
        const { answers, currentQuestionIndex: rawIndex, revealedFeedback: rawRevealed } = body;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const access = await hasCourseAccess(userId, resolvedParams.courseId);
        if (!access) {
            return new NextResponse("Course access required", { status: 403 });
        }

        const quiz = await db.quiz.findFirst({
            where: {
                id: resolvedParams.quizId,
                courseId: resolvedParams.courseId,
                isPublished: true,
            },
            include: {
                _count: { select: { questions: true } },
            },
        });

        if (!quiz) {
            return new NextResponse("Quiz not found", { status: 404 });
        }

        const normalized = Array.isArray(answers)
            ? answers.map((a: { questionId: string; answer: string }) => ({
                  questionId: String(a.questionId),
                  answer: String(a.answer ?? ""),
              }))
            : [];

        const questionCount = quiz._count.questions;
        const hasIndex = typeof rawIndex === "number" && Number.isFinite(rawIndex);
        const clampedIndex = hasIndex
            ? clampQuestionIndex(rawIndex, questionCount)
            : undefined;

        const existingDraft = await db.quizDraft.findUnique({
            where: {
                userId_quizId: { userId, quizId: resolvedParams.quizId },
            },
            select: { revealedFeedback: true },
        });

        const revealedFeedback =
            rawRevealed !== undefined
                ? normalizeRevealedFeedback(rawRevealed)
                : normalizeRevealedFeedback(existingDraft?.revealedFeedback);

        await db.quizDraft.upsert({
            where: {
                userId_quizId: { userId, quizId: resolvedParams.quizId },
            },
            create: {
                userId,
                quizId: resolvedParams.quizId,
                answers: normalized,
                currentQuestionIndex: clampedIndex ?? 0,
                revealedFeedback,
            },
            update: {
                answers: normalized,
                revealedFeedback,
                ...(clampedIndex !== undefined ? { currentQuestionIndex: clampedIndex } : {}),
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.log("[QUIZ_DRAFT_PUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
