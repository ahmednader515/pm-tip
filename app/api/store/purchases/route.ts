import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const purchases = await db.productPurchase.findMany({
            where: {
                userId,
                status: "ACTIVE",
            },
            include: {
                product: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        imageUrl: true,
                        price: true,
                        downloadUrl: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(purchases);
    } catch (error) {
        console.error("[STORE_PURCHASES_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
