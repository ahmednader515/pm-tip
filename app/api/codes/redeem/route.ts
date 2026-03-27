import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { priceAfterDiscountPercent } from "@/lib/promo-code";

// POST - Redeem a code (promo: optional % discount; balance charged for remainder)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { code } = await req.json();

    if (!code || typeof code !== "string") {
      return new NextResponse("Code is required", { status: 400 });
    }

    const purchaseCode = await db.purchaseCode.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
    });

    if (!purchaseCode) {
      return new NextResponse("Invalid code", { status: 404 });
    }

    if (purchaseCode.isUsed) {
      return new NextResponse("Code has already been used", { status: 400 });
    }

    const existingPurchase = await db.purchase.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: purchaseCode.courseId,
        },
      },
    });

    if (existingPurchase && existingPurchase.status === "ACTIVE") {
      return new NextResponse("You have already purchased this course", { status: 400 });
    }

    const amountDue = priceAfterDiscountPercent(
      purchaseCode.course.price,
      purchaseCode.discountPercent
    );

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    if (amountDue > 0 && user.balance < amountDue) {
      return NextResponse.json(
        {
          error: "Insufficient balance",
          amountDue,
          balance: user.balance,
        },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      await tx.purchaseCode.update({
        where: { id: purchaseCode.id },
        data: {
          isUsed: true,
          usedBy: userId,
          usedAt: new Date(),
        },
      });

      if (existingPurchase && existingPurchase.status === "FAILED") {
        await tx.purchase.delete({
          where: {
            id: existingPurchase.id,
          },
        });
      }

      const purchase = await tx.purchase.create({
        data: {
          userId,
          courseId: purchaseCode.courseId,
          status: "ACTIVE",
          purchaseCodeId: purchaseCode.id,
        },
      });

      if (amountDue > 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            balance: { decrement: amountDue },
          },
        });

        await tx.balanceTransaction.create({
          data: {
            userId,
            amount: -amountDue,
            type: "PURCHASE",
            description:
              purchaseCode.discountPercent >= 100
                ? `شراء الكورس بكود ترويجي (خصم كامل): ${purchaseCode.course.title}`
                : `شراء الكورس بكود ترويجي (خصم ${purchaseCode.discountPercent}%): ${purchaseCode.course.title}`,
          },
        });
      }

      return { purchase };
    });

    const updatedUser = await db.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    return NextResponse.json({
      success: true,
      purchaseId: result.purchase.id,
      course: {
        id: purchaseCode.course.id,
        title: purchaseCode.course.title,
      },
      discountPercent: purchaseCode.discountPercent,
      amountCharged: amountDue,
      newBalance: updatedUser?.balance ?? user.balance,
    });
  } catch (error) {
    console.error("[REDEEM_CODE]", error);
    if (error instanceof Error) {
      return new NextResponse(`Internal Error: ${error.message}`, { status: 500 });
    }
    return new NextResponse("Internal Error", { status: 500 });
  }
}
