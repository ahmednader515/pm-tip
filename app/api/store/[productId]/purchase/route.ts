import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        const { userId } = await auth();
        const { productId } = await params;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const product = await db.storeProduct.findFirst({
            where: {
                id: productId,
                isPublished: true,
            },
        });

        if (!product) {
            return new NextResponse("Product not found or not available", { status: 404 });
        }

        const existingPurchase = await db.productPurchase.findUnique({
            where: {
                userId_productId: { userId, productId },
            },
        });

        if (existingPurchase?.status === "ACTIVE") {
            return new NextResponse("You have already purchased this product", { status: 400 });
        }

        const user = await db.user.findUnique({
            where: { id: userId },
            select: { balance: true },
        });

        if (!user) {
            return new NextResponse("User not found", { status: 404 });
        }

        const price = product.price;

        if (user.balance < price) {
            return new NextResponse("Insufficient balance", { status: 400 });
        }

        const result = await db.$transaction(async (tx) => {
            if (existingPurchase && existingPurchase.status === "FAILED") {
                await tx.productPurchase.delete({
                    where: { id: existingPurchase.id },
                });
            }

            const purchase = await tx.productPurchase.create({
                data: {
                    userId,
                    productId,
                    status: "ACTIVE",
                    pricePaid: price,
                },
            });

            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { balance: { decrement: price } },
            });

            await tx.balanceTransaction.create({
                data: {
                    userId,
                    amount: -price,
                    type: "PURCHASE",
                    description: `تم شراء المنتج: ${product.title}`,
                },
            });

            return { purchase, updatedUser };
        });

        return NextResponse.json({
            success: true,
            purchaseId: result.purchase.id,
            newBalance: result.updatedUser.balance,
        });
    } catch (error) {
        console.error("[STORE_PURCHASE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
