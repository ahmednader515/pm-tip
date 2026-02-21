"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, BookOpen, Loader2, Play, Award } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type QuizItem = {
    quizId: string;
    courseId: string;
    courseTitle: string;
    title: string;
    description: string | null;
    maxAttempts: number;
    attemptCount: number;
    hasDraft: boolean;
    draftUpdatedAt: string | null;
};

export default function StudentQuizzesPage() {
    const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const fetchQuizzes = async () => {
        try {
            const res = await fetch("/api/student/quizzes", { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                setQuizzes(data);
            } else {
                toast.error("فشل تحميل الاختبارات");
            }
        } catch {
            toast.error("فشل تحميل الاختبارات");
        } finally {
            setLoading(false);
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
                    <FileText className="h-7 w-7" />
                    الاختبارات
                </h1>
                <p className="text-muted-foreground mt-1">
                    اختبارات الكورسات التي لديك فيها صلاحية. يمكنك البدء أو متابعة اختبار محفوظ.
                </p>
            </div>

            {quizzes.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                            لا توجد اختبارات متاحة في الكورسات المشتراة أو المجانية.
                        </p>
                        <Button asChild className="mt-4" variant="outline">
                            <Link href="/dashboard/search">استعراض الكورسات</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {quizzes.map((q) => {
                        const canTakeMore = q.attemptCount < q.maxAttempts;
                        const href = `/courses/${q.courseId}/quizzes/${q.quizId}`;
                        return (
                            <Card key={q.quizId} className="flex flex-col">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <BookOpen className="h-4 w-4" />
                                        {q.courseTitle}
                                    </div>
                                    <CardTitle className="text-lg">{q.title}</CardTitle>
                                    {q.description && (
                                        <CardDescription className="line-clamp-2">
                                            {q.description}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent className="mt-auto pt-0 flex flex-col gap-3">
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary">
                                            المحاولة {q.attemptCount} من {q.maxAttempts}
                                        </Badge>
                                        {q.hasDraft && (
                                            <Badge variant="outline">تم حفظ إجابات</Badge>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Button asChild disabled={!canTakeMore} className="w-full" size="sm">
                                            <Link href={href} className="flex items-center justify-center gap-2">
                                                <Play className="h-4 w-4" />
                                                {q.hasDraft ? "متابعة الاختبار" : canTakeMore ? "بدء الاختبار" : "استنفدت المحاولات"}
                                            </Link>
                                        </Button>
                                        {q.maxAttempts > 1 && q.attemptCount >= 1 && (
                                            <Button asChild variant="outline" className="w-full" size="sm">
                                                <Link href={`/courses/${q.courseId}/quizzes/${q.quizId}/result`} className="flex items-center justify-center gap-2">
                                                    <Award className="h-4 w-4" />
                                                    عرض النتيجة
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
