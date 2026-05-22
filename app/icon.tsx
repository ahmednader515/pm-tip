import {
    getAppBaseUrl,
    getCachedHomepageContent,
    toAbsoluteAssetUrl,
} from "@/lib/homepage-db";

export const runtime = "nodejs";

export default async function Icon() {
    const { headerLogoUrl } = await getCachedHomepageContent();
    const src = toAbsoluteAssetUrl(headerLogoUrl);

    try {
        const res = await fetch(src, { cache: "no-store" });
        if (!res.ok) {
            throw new Error(`Failed to fetch icon: ${res.status}`);
        }

        const bytes = await res.arrayBuffer();
        const contentType =
            res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";

        return new Response(bytes, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=3600, must-revalidate",
            },
        });
    } catch (error) {
        console.error("[ICON]", error);
        const fallback = await fetch(`${getAppBaseUrl()}/logo.png`, {
            cache: "no-store",
        });
        const bytes = await fallback.arrayBuffer();
        return new Response(bytes, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=3600, must-revalidate",
            },
        });
    }
}
