import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getAccessibleCourseIdsIncludingFree } from "@/lib/course-access";
import { getCourseCertificateStatus } from "@/lib/course-certificate";

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const accessible = await getAccessibleCourseIdsIncludingFree(userId);
        if (accessible.size === 0) return NextResponse.json([]);

        const courseIds = Array.from(accessible);
        const statuses = await Promise.all(courseIds.map((courseId) => getCourseCertificateStatus(userId, courseId)));

        const earned = statuses
            .filter((s): s is NonNullable<typeof s> => Boolean(s))
            .filter((s) => s.certificateEnabled && s.eligible)
            .map((s) => ({
                courseId: s.courseId,
                courseTitle: s.courseTitle,
                totalChapters: s.totalChapters,
                completedChapters: s.completedChapters,
                totalQuizzes: s.totalQuizzes,
                completedQuizzes: s.completedQuizzes,
                completedAt: s.latestQuizSubmissionAt,
            }));

        return NextResponse.json(earned);
    } catch (error) {
        console.log("[STUDENT_CERTIFICATES_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

