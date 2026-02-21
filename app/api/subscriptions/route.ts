import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? null;
    const now = new Date();

    const subscriptions = await db.subscription.findMany({
      where: {
        courses: {
          some: {},
        },
      },
      include: {
        courses: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                imageUrl: true,
                isPublished: true,
              },
            },
          },
        },
        user: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let myPurchasesMap: Record<string, { expiresAt: string }> = {};
    let expiredMap: Record<string, string> = {};
    if (userId) {
      const [activePurchases, expiredPurchases] = await Promise.all([
        db.subscriptionPurchase.findMany({
          where: {
            userId,
            expiresAt: { gt: now },
          },
          orderBy: { expiresAt: "desc" },
        }),
        db.subscriptionPurchase.findMany({
          where: {
            userId,
            expiresAt: { lte: now },
          },
          orderBy: { expiresAt: "desc" },
        }),
      ]);
      activePurchases.forEach((p) => {
        if (!myPurchasesMap[p.subscriptionId]) {
          myPurchasesMap[p.subscriptionId] = { expiresAt: p.expiresAt.toISOString() };
        }
      });
      expiredPurchases.forEach((p) => {
        if (!expiredMap[p.subscriptionId]) {
          expiredMap[p.subscriptionId] = p.expiresAt.toISOString();
        }
      });
    }

    const list = subscriptions.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      price: s.price,
      teacherName: s.user.fullName,
      courses: s.courses
        .map((sc) => sc.course)
        .filter((c) => c.isPublished),
      myPurchase: myPurchasesMap[s.id] ?? null,
      expiredAt: expiredMap[s.id] ?? null,
    })).filter((s) => s.courses.length > 0);

    const response = NextResponse.json(list);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    console.error("[SUBSCRIPTIONS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
