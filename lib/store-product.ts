export type StoreProductInput = {
    title?: string;
    description?: string | null;
    imageUrl?: string | null;
    price?: number;
    downloadUrl?: string;
    isPublished?: boolean;
    position?: number;
};

export function parseStoreProductBody(body: unknown): {
    data: StoreProductInput;
    error?: string;
} {
    if (!body || typeof body !== "object") {
        return { data: {}, error: "Invalid body" };
    }
    const b = body as Record<string, unknown>;
    const data: StoreProductInput = {};

    if (b.title !== undefined) {
        const title = String(b.title).trim();
        if (!title) return { data: {}, error: "Title is required" };
        data.title = title;
    }
    if (b.description !== undefined) {
        data.description = b.description == null ? null : String(b.description);
    }
    if (b.imageUrl !== undefined) {
        data.imageUrl = b.imageUrl == null || b.imageUrl === "" ? null : String(b.imageUrl);
    }
    if (b.price !== undefined) {
        const price = Number(b.price);
        if (!Number.isFinite(price) || price < 0) {
            return { data: {}, error: "Price must be a non-negative number" };
        }
        data.price = price;
    }
    if (b.downloadUrl !== undefined) {
        const downloadUrl = String(b.downloadUrl).trim();
        if (!downloadUrl) return { data: {}, error: "Download URL is required" };
        data.downloadUrl = downloadUrl;
    }
    if (b.isPublished !== undefined) {
        data.isPublished = Boolean(b.isPublished);
    }
    if (b.position !== undefined) {
        const position = Number(b.position);
        if (!Number.isInteger(position) || position < 0) {
            return { data: {}, error: "Position must be a non-negative integer" };
        }
        data.position = position;
    }

    return { data };
}

export function validateStoreProductCreate(data: StoreProductInput): string | null {
    if (!data.title?.trim()) return "Title is required";
    if (data.price === undefined || !Number.isFinite(data.price) || data.price < 0) {
        return "Price is required";
    }
    if (!data.downloadUrl?.trim()) return "Download URL is required";
    return null;
}
