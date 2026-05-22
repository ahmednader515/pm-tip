import { ImageResponse } from "next/og";
import {
    getCachedHomepageContent,
    toAbsoluteAssetUrl,
} from "@/lib/homepage-db";

export const runtime = "nodejs";

export const size = {
    width: 32,
    height: 32,
};

export const contentType = "image/png";

export default async function Icon() {
    const { headerLogoUrl } = await getCachedHomepageContent();
    const src = toAbsoluteAssetUrl(headerLogoUrl);

    return new ImageResponse(
        (
            <div
                style={{
                    background: "transparent",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <img
                    src={src}
                    alt="Logo"
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                    }}
                />
            </div>
        ),
        {
            ...size,
            headers: {
                "Cache-Control": "public, max-age=3600, must-revalidate",
            },
        }
    );
}
