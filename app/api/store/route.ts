import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const listSelect = {
    id: true,
    title: true,
    description: true,
    imageUrl: true,
    price: true,
    position: true,
} as const;

export async function GET() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const products = await db.storeProduct.findMany({
            where: { isPublished: true },
            select: listSelect,
            orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        });

        const purchases = await db.productPurchase.findMany({
            where: {
                userId,
                status: "ACTIVE",
                productId: { in: products.map((p) => p.id) },
            },
            select: { productId: true },
        });

        const purchasedIds = new Set(purchases.map((p) => p.productId));

        return NextResponse.json(
            products.map((p) => ({
                ...p,
                isPurchased: purchasedIds.has(p.id),
            }))
        );
    } catch (error) {
        console.error("[STORE_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
