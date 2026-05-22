import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
    parseStoreProductBody,
    validateStoreProductCreate,
} from "@/lib/store-product";

export async function GET() {
    try {
        const { userId, user } = await auth();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (user?.role !== "ADMIN") {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const products = await db.storeProduct.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
                _count: {
                    select: { purchases: true },
                },
            },
            orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        });

        return NextResponse.json(products);
    } catch (error) {
        console.error("[ADMIN_STORE_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, user } = await auth();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (user?.role !== "ADMIN") {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const body = await req.json();
        const { data, error: parseError } = parseStoreProductBody(body);
        if (parseError) {
            return new NextResponse(parseError, { status: 400 });
        }

        const validationError = validateStoreProductCreate(data);
        if (validationError) {
            return new NextResponse(validationError, { status: 400 });
        }

        const product = await db.storeProduct.create({
            data: {
                userId,
                title: data.title!,
                description: data.description ?? null,
                imageUrl: data.imageUrl ?? null,
                price: data.price!,
                downloadUrl: data.downloadUrl!,
                isPublished: data.isPublished ?? false,
                position: data.position ?? 0,
            },
            include: {
                user: {
                    select: { id: true, fullName: true },
                },
            },
        });

        return NextResponse.json(product);
    } catch (error) {
        console.error("[ADMIN_STORE_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
