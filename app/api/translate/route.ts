import { NextResponse } from "next/server";

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

async function translateOne(text: string): Promise<string> {
    if (!text?.trim()) return text ?? "";
    const encoded = encodeURIComponent(text.trim().slice(0, 500)); // MyMemory ~500 bytes limit
    const url = `${MYMEMORY_URL}?q=${encoded}&langpair=ar|en`;
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    return typeof translated === "string" ? translated : text;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const texts = Array.isArray(body.texts) ? body.texts : body.text ? [body.text] : [];
        if (texts.length === 0) {
            return NextResponse.json({ translations: [] });
        }
        const results: string[] = [];
        for (let i = 0; i < texts.length; i++) {
            const t = await translateOne(String(texts[i] ?? ""));
            results.push(t);
            if (i < texts.length - 1) {
                await new Promise((r) => setTimeout(r, 150));
            }
        }
        return NextResponse.json({ translations: results });
    } catch (error) {
        console.error("[TRANSLATE]", error);
        return NextResponse.json({ error: "Translation failed" }, { status: 500 });
    }
}
