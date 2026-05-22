import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const publicSelect = {
    id: true,
    title: true,
    description: true,
    imageUrl: true,
    price: true,
    position: true,
} as const;

export async function GET() {
    try {
        const products = await db.storeProduct.findMany({
            where: { isPublished: true },
            select: publicSelect,
            orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        });

        return NextResponse.json(products);
    } catch (error) {
        console.error("[STORE_PUBLIC_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
