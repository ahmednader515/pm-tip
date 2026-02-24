import { NextResponse } from "next/server";

const LIBRETRANSLATE_URL = "https://libretranslate.com/translate";
const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

const CONCURRENCY = 12;

/**
 * LibreTranslate: one request for all texts (fast).
 * API: POST with q as array, source "ar", target "en" -> translatedText array.
 */
async function translateWithLibreTranslate(texts: string[]): Promise<string[] | null> {
    const trimmed = texts.map((t) => String(t ?? "").trim().slice(0, 5000));
    const payload: { q: string[]; source: string; target: string; format: string; api_key?: string } = {
        q: trimmed,
        source: "ar",
        target: "en",
        format: "text",
    };
    const apiKey = process.env.LIBRETRANSLATE_API_KEY;
    if (apiKey) payload.api_key = apiKey;

    const res = await fetch(LIBRETRANSLATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const out = data?.translatedText;
    if (Array.isArray(out) && out.length === texts.length) return out;
    if (typeof out === "string" && texts.length === 1) return [out];
    return null;
}

async function translateOneMyMemory(text: string): Promise<string> {
    if (!text?.trim()) return text ?? "";
    const encoded = encodeURIComponent(text.trim().slice(0, 500));
    const url = `${MYMEMORY_URL}?q=${encoded}&langpair=ar|en`;
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    return typeof translated === "string" ? translated : text;
}

async function translateWithMyMemoryParallel(texts: string[]): Promise<string[]> {
    const results: string[] = new Array(texts.length);
    for (let i = 0; i < texts.length; i += CONCURRENCY) {
        const chunk = texts.slice(i, i + CONCURRENCY);
        const translated = await Promise.all(chunk.map((t) => translateOneMyMemory(t)));
        for (let j = 0; j < translated.length; j++) results[i + j] = translated[j];
    }
    return results;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const texts = Array.isArray(body.texts) ? body.texts : body.text ? [body.text] : [];
        if (texts.length === 0) {
            return NextResponse.json({ translations: [] });
        }

        let translations: string[];

        const libre = await translateWithLibreTranslate(texts);
        if (libre != null) {
            translations = libre;
        } else {
            translations = await translateWithMyMemoryParallel(texts);
        }

        return NextResponse.json({ translations });
    } catch (error) {
        console.error("[TRANSLATE]", error);
        return NextResponse.json({ error: "Translation failed" }, { status: 500 });
    }
}
