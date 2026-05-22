import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { hasCourseAccess } from "@/lib/course-access";

/** Correct answers and explanations are only shown on the result page after submit. */
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

        return new NextResponse(
            "Correct answers are available after you finish the quiz",
            { status: 403 }
        );
    } catch (error) {
        console.error("[QUIZ_CORRECT_ANSWER]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
