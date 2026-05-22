import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
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
            select: {
                id: true,
                title: true,
                description: true,
                imageUrl: true,
                price: true,
                position: true,
            },
        });

        if (!product) {
            return new NextResponse("Product not found", { status: 404 });
        }

        const purchase = await db.productPurchase.findUnique({
            where: {
                userId_productId: { userId, productId },
            },
        });

        const isPurchased = purchase?.status === "ACTIVE";

        if (!isPurchased) {
            return NextResponse.json({ ...product, isPurchased: false });
        }

        const full = await db.storeProduct.findUnique({
            where: { id: productId },
            select: {
                id: true,
                title: true,
                description: true,
                imageUrl: true,
                price: true,
                downloadUrl: true,
                position: true,
            },
        });

        return NextResponse.json({
            ...full,
            isPurchased: true,
        });
    } catch (error) {
        console.error("[STORE_PRODUCT_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
