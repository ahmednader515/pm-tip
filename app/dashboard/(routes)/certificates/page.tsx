"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Award, Download, Loader2, BookOpen, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { localizedField } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

type CertificateItem = {
    courseId: string;
    courseTitle: string;
    courseTitleEn?: string | null;
    totalChapters: number;
    completedChapters: number;
    totalQuizzes: number;
    completedQuizzes: number;
    completedAt: string | null;
};

export default function CertificatesPage() {
    const [items, setItems] = useState<CertificateItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [names, setNames] = useState<Record<string, string>>({});
    const t = useTranslations("dashboard.student.certificates");
    const locale = useLocale() as Locale;

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/student/certificates", { cache: "no-store" });
                if (!res.ok) {
                    toast.error(t("loadFailed"));
                    return;
                }
                const data = await res.json();
                setItems(Array.isArray(data) ? data : []);
            } catch {
                toast.error(t("loadFailed"));
            } finally {
                setLoading(false);
            }
        })();
    }, [t]);

    const downloadCertificate = async (courseId: string) => {
        const name = (names[courseId] || "").trim();
        if (!name) return;
        setDownloading(courseId);
        try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = "/certificate.png";
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error("Failed to load certificate image"));
            });

            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas not supported");
            ctx.drawImage(img, 0, 0);

            const x = canvas.width / 2;
            const y = Math.round(canvas.height * 0.5);
            const fontSize = Math.max(34, Math.round(canvas.width * 0.05));
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#111827";
            ctx.font = `700 ${fontSize}px Cairo, Arial, sans-serif`;
            ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.09));
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.strokeText(name, x, y);
            ctx.fillText(name, x, y);

            const url = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = url;
            a.download = `course-certificate-${courseId}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch {
            toast.error(t("downloadFailed"));
        } finally {
            setDownloading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Award className="h-7 w-7" />
                    {t("title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                    {t("subtitle")}
                </p>
            </div>

            {items.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Award className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                            {t("empty")}
                        </p>
                        <Button asChild className="mt-4" variant="outline">
                            <Link href="/dashboard/quizzes">{t("viewQuizzes")}</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((c) => (
                        <Card key={c.courseId} className="flex flex-col">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <BookOpen className="h-4 w-4" />
                                    {localizedField({ title: c.courseTitle, titleEn: c.courseTitleEn }, "title", locale)}
                                </div>
                                <CardTitle className="text-lg">{t("courseCertificate")}</CardTitle>
                                <CardDescription>
                                    {t("chaptersQuizzes", {
                                        completedChapters: c.completedChapters,
                                        totalChapters: c.totalChapters,
                                        completedQuizzes: c.completedQuizzes,
                                        totalQuizzes: c.totalQuizzes,
                                    })}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="mt-auto pt-0 flex flex-col gap-3">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="secondary">{t("passed")}</Badge>
                                    <Badge variant="outline">
                                        {c.completedAt
                                            ? new Date(c.completedAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")
                                            : t("completed")}
                                    </Badge>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Input
                                        value={names[c.courseId] || ""}
                                        onChange={(e) => setNames((prev) => ({ ...prev, [c.courseId]: e.target.value }))}
                                        placeholder={t("namePlaceholder")}
                                        dir="auto"
                                    />
                                    <Button
                                        size="sm"
                                        onClick={() => downloadCertificate(c.courseId)}
                                        disabled={downloading === c.courseId || !(names[c.courseId] || "").trim()}
                                        className="w-full gap-2 bg-brand text-white hover:bg-brand/90"
                                    >
                                        <Download className="h-4 w-4" />
                                        {downloading === c.courseId ? t("downloading") : t("download")}
                                    </Button>
                                    <Button asChild variant="secondary" size="sm" className="w-full">
                                        <Link
                                            href={`/courses/${c.courseId}/certificate`}
                                            className="flex items-center justify-center gap-2"
                                        >
                                            <FileText className="h-4 w-4" />
                                            {t("viewPage")}
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
