export const HOMEPAGE_SETTINGS_ID = "default";

export type HomepageFeatureIcon = "star" | "users" | "award" | "book" | "bookopen";

export type HomepageTestimonial = {
    name: string;
    grade: string;
    testimonial: string;
    avatarUrl?: string | null;
};

export type HomepageFeature = {
    title: string;
    description: string;
    icon: HomepageFeatureIcon;
};

export type HomepageContent = {
    teacherImageUrl: string;
    headerLogoUrl: string;
    footerPhone: string;
    testimonials: HomepageTestimonial[];
    features: HomepageFeature[];
};

export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
    teacherImageUrl: "/logo.png",
    headerLogoUrl: "/logo.png",
    footerPhone: "01009560680",
    testimonials: [
        {
            name: "عصام اسامة",
            grade: "الصف الأول الثانوي",
            testimonial: "تجربة رائعة مع منصة PM TIPS، المحتوى غني والشرح مبسط",
            avatarUrl: "/male.png",
        },
        {
            name: "سيف طارق",
            grade: "الصف الثاني الثانوي",
            testimonial: "المنهج منظم جداً والشرح واضح، ساعدني في فهم المواد بشكل أفضل",
            avatarUrl: "/male.png",
        },
        {
            name: "عمر جمال",
            grade: "الصف الأول الثانوي",
            testimonial: "أفضل منصة تعليمية استخدمتها، المحتوى غني والشرح مبسط",
            avatarUrl: "/male.png",
        },
    ],
    features: [
        {
            title: "جودة عالية",
            description: "أفضل منصة متخصصة لكورسات جميع المواد",
            icon: "star",
        },
        {
            title: "مجتمع نشط",
            description: "انضم إلى مجتمع من الطلاب النشطين والمتفوقين والأوائل",
            icon: "users",
        },
        {
            title: "شهادات تقدير",
            description: "احصل على شهادات تقدير عند إكمال الكورسات",
            icon: "award",
        },
    ],
};

const FEATURE_ICONS: HomepageFeatureIcon[] = ["star", "users", "award", "book", "bookopen"];

function parseTestimonials(raw: unknown): HomepageTestimonial[] {
    if (!Array.isArray(raw)) return DEFAULT_HOMEPAGE_CONTENT.testimonials;
    const parsed = raw
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const t = item as Record<string, unknown>;
            const name = String(t.name ?? "").trim();
            const grade = String(t.grade ?? "").trim();
            const testimonial = String(t.testimonial ?? "").trim();
            if (!name || !testimonial) return null;
            return {
                name,
                grade,
                testimonial,
                avatarUrl:
                    t.avatarUrl == null || t.avatarUrl === ""
                        ? "/male.png"
                        : String(t.avatarUrl),
            };
        })
        .filter((x): x is HomepageTestimonial => x !== null);
    return parsed.length ? parsed : DEFAULT_HOMEPAGE_CONTENT.testimonials;
}

function parseFeatures(raw: unknown): HomepageFeature[] {
    if (!Array.isArray(raw)) return DEFAULT_HOMEPAGE_CONTENT.features;
    const parsed = raw
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const f = item as Record<string, unknown>;
            const title = String(f.title ?? "").trim();
            const description = String(f.description ?? "").trim();
            const iconRaw = String(f.icon ?? "star").toLowerCase();
            const icon = FEATURE_ICONS.includes(iconRaw as HomepageFeatureIcon)
                ? (iconRaw as HomepageFeatureIcon)
                : "star";
            if (!title || !description) return null;
            return { title, description, icon };
        })
        .filter((x): x is HomepageFeature => x !== null);
    return parsed.length ? parsed : DEFAULT_HOMEPAGE_CONTENT.features;
}

export function toHomepageContent(row: {
    teacherImageUrl: string | null;
    headerLogoUrl: string | null;
    footerPhone: string;
    testimonials: unknown;
    features: unknown;
}): HomepageContent {
    return {
        teacherImageUrl: row.teacherImageUrl?.trim() || DEFAULT_HOMEPAGE_CONTENT.teacherImageUrl,
        headerLogoUrl: row.headerLogoUrl?.trim() || DEFAULT_HOMEPAGE_CONTENT.headerLogoUrl,
        footerPhone: row.footerPhone?.trim() || DEFAULT_HOMEPAGE_CONTENT.footerPhone,
        testimonials: parseTestimonials(row.testimonials),
        features: parseFeatures(row.features),
    };
}

export function parseHomepageUpdateBody(body: unknown): {
    data: Partial<HomepageContent>;
    error?: string;
} {
    if (!body || typeof body !== "object") {
        return { data: {}, error: "Invalid body" };
    }
    const b = body as Record<string, unknown>;
    const data: Partial<HomepageContent> = {};

    if (b.teacherImageUrl !== undefined) {
        data.teacherImageUrl =
            b.teacherImageUrl == null || b.teacherImageUrl === ""
                ? DEFAULT_HOMEPAGE_CONTENT.teacherImageUrl
                : String(b.teacherImageUrl);
    }
    if (b.headerLogoUrl !== undefined) {
        data.headerLogoUrl =
            b.headerLogoUrl == null || b.headerLogoUrl === ""
                ? DEFAULT_HOMEPAGE_CONTENT.headerLogoUrl
                : String(b.headerLogoUrl);
    }
    if (b.footerPhone !== undefined) {
        const phone = String(b.footerPhone).trim();
        if (!phone) return { data: {}, error: "Footer phone is required" };
        data.footerPhone = phone;
    }
    if (b.testimonials !== undefined) {
        const testimonials = parseTestimonials(b.testimonials);
        if (!testimonials.length) {
            return { data: {}, error: "At least one testimonial is required" };
        }
        data.testimonials = testimonials;
    }
    if (b.features !== undefined) {
        const features = parseFeatures(b.features);
        if (!features.length) {
            return { data: {}, error: "At least one feature is required" };
        }
        data.features = features;
    }

    return { data };
}
