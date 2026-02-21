import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasCourseAccess } from "@/lib/course-access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const resolvedParams = await params;
  const { courseId } = resolvedParams;

  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const course = await db.course.findUnique({
      where: {
        id: courseId,
        isPublished: true,
      },
    });

    if (!course) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Free courses are always accessible
    if (course.price === 0) {
      return NextResponse.json({ hasAccess: true });
    }

    const access = await hasCourseAccess(userId, courseId);
    return NextResponse.json({ hasAccess: access });
  } catch (error) {
    console.error("[COURSE_ACCESS]", error);
    if (error instanceof Error) {
      return new NextResponse(`Internal Error: ${error.message}`, { status: 500 });
    }
    return new NextResponse("Internal Error", { status: 500 });
  }
} 