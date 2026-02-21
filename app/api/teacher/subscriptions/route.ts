import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (session.user.role !== "TEACHER") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const subscriptions = await db.subscription.findMany({
      where: { userId: session.user.id },
      include: {
        courses: {
          include: {
            course: {
              select: { id: true, title: true, imageUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error("[TEACHER_SUBSCRIPTIONS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (session.user.role !== "TEACHER") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = await req.json();
    const { title, type, price, courseIds } = body as {
      title?: string;
      type?: string;
      price?: number;
      courseIds?: string[];
    };

    if (!title || !type || !Array.isArray(courseIds)) {
      return new NextResponse("Missing title, type, or courseIds", { status: 400 });
    }
    if (type !== "MONTHLY" && type !== "YEARLY") {
      return new NextResponse("type must be MONTHLY or YEARLY", { status: 400 });
    }
    const priceNum = typeof price === "number" ? price : parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return new NextResponse("Invalid price", { status: 400 });
    }

    const teacherId = session.user.id;
    const myCourses = await db.course.findMany({
      where: { userId: teacherId },
      select: { id: true },
    });
    const myCourseIds = new Set(myCourses.map((c) => c.id));
    const validCourseIds = (courseIds as string[]).filter((id) => myCourseIds.has(id));
    if (validCourseIds.length === 0) {
      return new NextResponse("Select at least one of your courses", { status: 400 });
    }

    const subscription = await db.subscription.create({
      data: {
        userId: teacherId,
        title: title.trim(),
        type,
        price: priceNum,
        courses: {
          create: validCourseIds.map((courseId) => ({ courseId })),
        },
      },
      include: {
        courses: {
          include: {
            course: {
              select: { id: true, title: true, imageUrl: true },
            },
          },
        },
      },
    });

    return NextResponse.json(subscription);
  } catch (error) {
    console.error("[TEACHER_SUBSCRIPTIONS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
