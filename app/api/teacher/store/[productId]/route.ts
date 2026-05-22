import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseStoreProductBody } from "@/lib/store-product";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        const { userId, user } = await auth();
        const { productId } = await params;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (user?.role !== "TEACHER") {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const product = await db.storeProduct.findFirst({
            where: { id: productId, userId },
        });

        if (!product) {
            return new NextResponse("Product not found", { status: 404 });
        }

        return NextResponse.json(product);
    } catch (error) {
        console.error("[TEACHER_STORE_PRODUCT_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        const { userId, user } = await auth();
        const { productId } = await params;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (user?.role !== "TEACHER") {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const existing = await db.storeProduct.findFirst({
            where: { id: productId, userId },
        });

        if (!existing) {
            return new NextResponse("Product not found", { status: 404 });
        }

        const body = await req.json();
        const { data, error: parseError } = parseStoreProductBody(body);
        if (parseError) {
            return new NextResponse(parseError, { status: 400 });
        }

        if (Object.keys(data).length === 0) {
            return new NextResponse("No fields to update", { status: 400 });
        }

        const product = await db.storeProduct.update({
            where: { id: productId },
            data,
        });

        return NextResponse.json(product);
    } catch (error) {
        console.error("[TEACHER_STORE_PRODUCT_PATCH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        const { userId, user } = await auth();
        const { productId } = await params;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (user?.role !== "TEACHER") {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const existing = await db.storeProduct.findFirst({
            where: { id: productId, userId },
        });

        if (!existing) {
            return new NextResponse("Product not found", { status: 404 });
        }

        await db.storeProduct.delete({
            where: { id: productId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[TEACHER_STORE_PRODUCT_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
