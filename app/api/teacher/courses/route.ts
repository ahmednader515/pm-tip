import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const role = session.user.role;
    if (role !== "TEACHER" && role !== "ADMIN") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const courses = await db.course.findMany({
      where: role === "ADMIN" ? undefined : { userId: session.user.id },
      select: { id: true, title: true, titleEn: true, imageUrl: true, isPublished: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(courses);
  } catch (error) {
    console.error("[TEACHER_COURSES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
