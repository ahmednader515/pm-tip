"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Download, Loader2, BookOpen, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type CertificateItem = {
    quizId: string;
    courseId: string;
    courseTitle: string;
    quizTitle: string;
    percentage: number;
    passPercentage: number;
    submittedAt: string;
};

export default function CertificatesPage() {
    const [items, setItems] = useState<CertificateItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/student/certificates", { cache: "no-store" });
                if (!res.ok) {
                    toast.error("فشل تحميل الشهادات");
                    return;
                }
                const data = await res.json();
                setItems(Array.isArray(data) ? data : []);
            } catch {
                toast.error("فشل تحميل الشهادات");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const downloadCertificate = async (quizId: string) => {
        setDownloading(quizId);
        try {
            const res = await fetch("/certificate.png", { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to fetch certificate");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `certificate-${quizId}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("فشل تحميل الشهادة");
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
                    الشهادات
                </h1>
                <p className="text-muted-foreground mt-1">
                    الشهادات التي حصلت عليها بعد اجتياز الاختبارات بنجاح.
                </p>
            </div>

            {items.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Award className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                            لا توجد شهادات بعد.
                        </p>
                        <Button asChild className="mt-4" variant="outline">
                            <Link href="/dashboard/quizzes">عرض الاختبارات</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((c) => (
                        <Card key={c.quizId} className="flex flex-col">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <BookOpen className="h-4 w-4" />
                                    {c.courseTitle}
                                </div>
                                <CardTitle className="text-lg">{c.quizTitle}</CardTitle>
                                <CardDescription>
                                    حصلت على {c.percentage.toFixed(1)}% (النجاح: {c.passPercentage}%)
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="mt-auto pt-0 flex flex-col gap-3">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="secondary">تم الاجتياز</Badge>
                                    <Badge variant="outline">
                                        {new Date(c.submittedAt).toLocaleDateString("ar-EG")}
                                    </Badge>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => downloadCertificate(c.quizId)}
                                        disabled={downloading === c.quizId}
                                        className="w-full gap-2"
                                    >
                                        <Download className="h-4 w-4" />
                                        {downloading === c.quizId ? "جاري التحميل..." : "تحميل الشهادة"}
                                    </Button>
                                    <Button asChild variant="secondary" size="sm" className="w-full">
                                        <Link
                                            href={`/courses/${c.courseId}/quizzes/${c.quizId}/result`}
                                            className="flex items-center justify-center gap-2"
                                        >
                                            <FileText className="h-4 w-4" />
                                            عرض النتيجة
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

