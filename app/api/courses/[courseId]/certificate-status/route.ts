import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasCourseAccess } from "@/lib/course-access";
import { getCourseCertificateStatus } from "@/lib/course-certificate";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    const resolved = await params;

    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const access = await hasCourseAccess(userId, resolved.courseId);
    if (!access) return new NextResponse("Course access required", { status: 403 });

    const status = await getCourseCertificateStatus(userId, resolved.courseId);
    if (!status) return new NextResponse("Course not found", { status: 404 });

    return NextResponse.json(status);
  } catch (error) {
    console.log("[COURSE_CERTIFICATE_STATUS]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

