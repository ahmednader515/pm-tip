import { cache } from "react";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import {
    DEFAULT_HOMEPAGE_CONTENT,
    HOMEPAGE_SETTINGS_ID,
    toHomepageContent,
    type HomepageContent,
} from "@/lib/homepage";

export function getAppBaseUrl(): string {
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (appUrl) {
        return appUrl.replace(/\/$/, "");
    }
    return "http://localhost:3000";
}

export function toAbsoluteAssetUrl(path: string, baseUrl = getAppBaseUrl()): string {
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }
    return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Bust Next.js full-route / data cache after CMS saves (required on Vercel). */
export function revalidateHomepagePaths() {
    revalidatePath("/", "layout");
    revalidatePath("/");
    revalidatePath("/icon");
}

export async function getHomepageContent(): Promise<HomepageContent> {
    noStore();

    const row = await db.homepageSettings.findUnique({
        where: { id: HOMEPAGE_SETTINGS_ID },
    });

    if (!row) {
        await db.homepageSettings.create({
            data: {
                id: HOMEPAGE_SETTINGS_ID,
                teacherImageUrl: DEFAULT_HOMEPAGE_CONTENT.teacherImageUrl,
                headerLogoUrl: DEFAULT_HOMEPAGE_CONTENT.headerLogoUrl,
                footerPhone: DEFAULT_HOMEPAGE_CONTENT.footerPhone,
                testimonials: DEFAULT_HOMEPAGE_CONTENT.testimonials,
                features: DEFAULT_HOMEPAGE_CONTENT.features,
            },
        });
        return DEFAULT_HOMEPAGE_CONTENT;
    }

    return toHomepageContent(row);
}

/** One DB read per request when used from layout + icon/metadata */
export const getCachedHomepageContent = cache(getHomepageContent);

export async function updateHomepageContent(
    partial: Partial<HomepageContent>
): Promise<HomepageContent> {
    const current = await getHomepageContent();
    const merged: HomepageContent = {
        teacherImageUrl: partial.teacherImageUrl ?? current.teacherImageUrl,
        headerLogoUrl: partial.headerLogoUrl ?? current.headerLogoUrl,
        footerPhone: partial.footerPhone ?? current.footerPhone,
        testimonials: partial.testimonials ?? current.testimonials,
        features: partial.features ?? current.features,
    };

    const row = await db.homepageSettings.upsert({
        where: { id: HOMEPAGE_SETTINGS_ID },
        create: {
            id: HOMEPAGE_SETTINGS_ID,
            teacherImageUrl: merged.teacherImageUrl,
            headerLogoUrl: merged.headerLogoUrl,
            footerPhone: merged.footerPhone,
            testimonials: merged.testimonials,
            features: merged.features,
        },
        update: {
            teacherImageUrl: merged.teacherImageUrl,
            headerLogoUrl: merged.headerLogoUrl,
            footerPhone: merged.footerPhone,
            testimonials: merged.testimonials,
            features: merged.features,
        },
    });

    const content = toHomepageContent(row);
    revalidateHomepagePaths();
    return content;
}
