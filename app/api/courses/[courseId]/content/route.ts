import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCourseCertificateStatus } from "@/lib/course-certificate";

type CourseContentItem = {
    id: string;
    position: number;
    type: "chapter" | "quiz" | "certificate";
    title?: string;
    isEligible?: boolean;
};

export async function GET(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        const resolvedParams = await params;
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Get chapters
        const chapters = await db.chapter.findMany({
            where: {
                courseId: resolvedParams.courseId,
                isPublished: true
            },
            include: {
                userProgress: {
                    where: { userId },
                    select: {
                        isCompleted: true
                    }
                }
            },
            orderBy: {
                position: "asc"
            }
        });

        // Get published quizzes
        const quizzes = await db.quiz.findMany({
            where: {
                courseId: resolvedParams.courseId,
                isPublished: true
            },
            include: {
                quizResults: {
                    where: { studentId: userId },
                    select: {
                        id: true,
                        score: true,
                        totalPoints: true,
                        percentage: true
                    }
                }
            },
            orderBy: {
                position: "asc"
            }
        });

        // Combine and sort by position
        const allContent: CourseContentItem[] = [
            ...chapters.map(chapter => ({
                ...chapter,
                type: 'chapter' as const
            })),
            ...quizzes.map(quiz => ({
                ...quiz,
                type: 'quiz' as const
            }))
        ].sort((a, b) => a.position - b.position);

        const certStatus = await getCourseCertificateStatus(userId, resolvedParams.courseId);
        if (certStatus?.certificateEnabled) {
            const maxPosition = allContent.length ? Math.max(...allContent.map((c) => c.position || 0)) : 0;
            allContent.push({
                id: "certificate",
                title: "الشهادة",
                position: maxPosition + 1,
                type: "certificate",
                isEligible: certStatus.eligible,
            });
        }

        return NextResponse.json(allContent);
    } catch (error) {
        console.log("[COURSE_CONTENT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
} 