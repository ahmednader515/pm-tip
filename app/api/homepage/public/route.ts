import { NextResponse } from "next/server";
import { getHomepageContent } from "@/lib/homepage-db";

export async function GET() {
    try {
        const content = await getHomepageContent();
        return NextResponse.json(content, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        console.error("[HOMEPAGE_PUBLIC_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
