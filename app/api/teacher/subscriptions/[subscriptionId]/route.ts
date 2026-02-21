import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (session.user.role !== "TEACHER") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { subscriptionId } = await params;
    const existing = await db.subscription.findFirst({
      where: { id: subscriptionId, userId: session.user.id },
    });
    if (!existing) {
      return new NextResponse("Subscription not found", { status: 404 });
    }

    const body = await req.json();
    const { title, type, price, courseIds } = body as {
      title?: string;
      type?: string;
      price?: number;
      courseIds?: string[];
    };

    const teacherId = session.user.id;
    const updates: { title?: string; type?: string; price?: number } = {};
    if (title !== undefined) updates.title = String(title).trim();
    if (type !== undefined) {
      if (type !== "MONTHLY" && type !== "YEARLY") {
        return new NextResponse("type must be MONTHLY or YEARLY", { status: 400 });
      }
      updates.type = type;
    }
    if (price !== undefined) {
      const priceNum = typeof price === "number" ? price : parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return new NextResponse("Invalid price", { status: 400 });
      }
      updates.price = priceNum;
    }

    if (Array.isArray(courseIds)) {
      const myCourses = await db.course.findMany({
        where: { userId: teacherId },
        select: { id: true },
      });
      const myCourseIds = new Set(myCourses.map((c) => c.id));
      const validCourseIds = (courseIds as string[]).filter((id) => myCourseIds.has(id));

      const subscription = await db.$transaction(async (tx) => {
        const sub = await tx.subscription.update({
          where: { id: subscriptionId },
          data: updates,
        });
        await tx.subscriptionCourse.deleteMany({
          where: { subscriptionId },
        });
        if (validCourseIds.length > 0) {
          await tx.subscriptionCourse.createMany({
            data: validCourseIds.map((courseId) => ({ subscriptionId, courseId })),
          });
        }
        return tx.subscription.findUnique({
          where: { id: subscriptionId },
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
      });
      return NextResponse.json(subscription);
    }

    const subscription = await db.subscription.update({
      where: { id: subscriptionId },
      data: updates,
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
    console.error("[TEACHER_SUBSCRIPTIONS_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (session.user.role !== "TEACHER") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { subscriptionId } = await params;
    const existing = await db.subscription.findFirst({
      where: { id: subscriptionId, userId: session.user.id },
    });
    if (!existing) {
      return new NextResponse("Subscription not found", { status: 404 });
    }

    await db.subscription.delete({
      where: { id: subscriptionId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TEACHER_SUBSCRIPTIONS_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
