import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHomepageContent, updateHomepageContent } from "@/lib/homepage-db";
import { parseHomepageUpdateBody } from "@/lib/homepage";

export async function GET() {
    try {
        const { userId, user } = await auth();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });
        if (user?.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

        const content = await getHomepageContent();
        return NextResponse.json(content);
    } catch (error) {
        console.error("[ADMIN_HOMEPAGE_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const { userId, user } = await auth();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });
        if (user?.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

        const body = await req.json();
        const { data, error } = parseHomepageUpdateBody(body);
        if (error) return new NextResponse(error, { status: 400 });
        if (Object.keys(data).length === 0) {
            return new NextResponse("No fields to update", { status: 400 });
        }

        const content = await updateHomepageContent(data);
        return NextResponse.json(content, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        console.error("[ADMIN_HOMEPAGE_PUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
