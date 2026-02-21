import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { subscriptionId } = await params;

    const subscription = await db.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        courses: {
          include: {
            course: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    if (!subscription) {
      return new NextResponse("الاشتراك غير موجود", { status: 404 });
    }
    if (subscription.courses.length === 0) {
      return new NextResponse("الاشتراك لا يحتوي على كورسات", { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { balance: true, role: true },
    });
    if (!user) {
      return new NextResponse("المستخدم غير موجود", { status: 404 });
    }
    if (user.balance < subscription.price) {
      return new NextResponse("رصيدك غير كافٍ", { status: 400 });
    }

    const courseIds = subscription.courses.map((sc) => sc.course.id);
    const existingPurchases = await db.purchase.findMany({
      where: {
        userId,
        courseId: { in: courseIds },
        status: "ACTIVE",
      },
      select: { courseId: true },
    });
    const existingCourseIds = new Set(existingPurchases.map((p) => p.courseId));
    const toAdd = subscription.courses.filter((sc) => !existingCourseIds.has(sc.course.id));

    const now = new Date();
    const durationDays = subscription.type === "MONTHLY" ? 30 : 365;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: subscription.price } },
      });
      await tx.balanceTransaction.create({
        data: {
          userId,
          amount: -subscription.price,
          type: "PURCHASE",
          description: `اشتراك: ${subscription.title} (${subscription.type})`,
        },
      });
      const subPurchase = await tx.subscriptionPurchase.create({
        data: {
          userId,
          subscriptionId,
          purchasedAt: now,
          expiresAt,
        },
      });

      const subscriptionCourseIds = subscription.courses.map((sc) => sc.course.id);

      // Explicitly link all existing purchases for these courses to the new subscription (renewal)
      await tx.purchase.updateMany({
        where: {
          userId,
          courseId: { in: subscriptionCourseIds },
        },
        data: {
          status: "ACTIVE",
          subscriptionPurchaseId: subPurchase.id,
        },
      });

      // Create any missing purchases (e.g. new courses added to subscription)
      for (const sc of subscription.courses) {
        await tx.purchase.upsert({
          where: {
            userId_courseId: { userId, courseId: sc.course.id },
          },
          create: {
            userId,
            courseId: sc.course.id,
            status: "ACTIVE",
            subscriptionPurchaseId: subPurchase.id,
          },
          update: {},
        });
      }
    });

    const updatedUser = await db.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    return NextResponse.json({
      success: true,
      newBalance: updatedUser?.balance ?? 0,
      coursesAdded: toAdd.length,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[SUBSCRIPTION_PURCHASE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
