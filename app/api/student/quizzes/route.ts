import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getAccessibleCourseIdsIncludingFree } from "@/lib/course-access";

export async function GET() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const courseIds = await getAccessibleCourseIdsIncludingFree(userId);
        if (courseIds.size === 0) {
            return NextResponse.json([]);
        }

        const quizzes = await db.quiz.findMany({
            where: {
                courseId: { in: Array.from(courseIds) },
                isPublished: true,
            },
            include: {
                course: {
                    select: { id: true, title: true },
                },
            },
            orderBy: [{ course: { title: "asc" } }, { position: "asc" }],
        });

        const quizIds = quizzes.map((q) => q.id);
        const [results, drafts] = await Promise.all([
            db.quizResult.groupBy({
                by: ["quizId"],
                where: { quizId: { in: quizIds }, studentId: userId },
                _count: { id: true },
            }),
            db.quizDraft.findMany({
                where: { userId, quizId: { in: quizIds } },
                select: { quizId: true, updatedAt: true },
            }),
        ]);

        const attemptCountByQuiz = new Map(
            results.map((r) => [r.quizId, r._count.id])
        );
        const draftByQuiz = new Map(
            drafts.map((d) => [d.quizId, d.updatedAt])
        );

        const list = quizzes.map((quiz) => ({
            quizId: quiz.id,
            courseId: quiz.courseId,
            courseTitle: quiz.course.title,
            title: quiz.title,
            description: quiz.description,
            maxAttempts: quiz.maxAttempts,
            attemptCount: attemptCountByQuiz.get(quiz.id) ?? 0,
            hasDraft: draftByQuiz.has(quiz.id),
            draftUpdatedAt: draftByQuiz.get(quiz.id) ?? null,
        }));

        return NextResponse.json(list);
    } catch (error) {
        console.log("[STUDENT_QUIZZES_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
