import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Earned certificate = quiz has certificate enabled AND student's best attempt >= pass percentage
        const results = await db.quizResult.findMany({
            where: {
                studentId: userId,
                quiz: {
                    isPublished: true,
                    certificateEnabled: true,
                },
            },
            include: {
                quiz: {
                    select: {
                        id: true,
                        title: true,
                        courseId: true,
                        certificatePassPercentage: true,
                        course: { select: { title: true } },
                    },
                },
            },
            orderBy: { submittedAt: "desc" },
        });

        const bestByQuiz = new Map<
            string,
            {
                quizId: string;
                courseId: string;
                courseTitle: string;
                quizTitle: string;
                percentage: number;
                passPercentage: number;
                submittedAt: string;
            }
        >();

        for (const r of results) {
            const pass = r.quiz.certificatePassPercentage ?? 60;
            if (r.percentage < pass) continue;

            const prev = bestByQuiz.get(r.quizId);
            const candidate = {
                quizId: r.quiz.id,
                courseId: r.quiz.courseId,
                courseTitle: r.quiz.course.title,
                quizTitle: r.quiz.title,
                percentage: r.percentage,
                passPercentage: pass,
                submittedAt: r.submittedAt.toISOString(),
            };

            if (!prev || candidate.percentage > prev.percentage) {
                bestByQuiz.set(r.quizId, candidate);
            }
        }

        return NextResponse.json(Array.from(bestByQuiz.values()));
    } catch (error) {
        console.log("[STUDENT_CERTIFICATES_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

