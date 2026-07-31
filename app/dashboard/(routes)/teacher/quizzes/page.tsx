"use client";

import { useLocale, useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Edit, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigationRouter } from "@/lib/hooks/use-navigation-router";
import { localizedField } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

interface Quiz {
    id: string;
    title: string;
    titleEn?: string | null;
    description: string;
    courseId: string;
    position: number;
    isPublished: boolean;
    course: {
        title: string;
        titleEn?: string | null;
    };
    questions: Question[];
    createdAt: string;
    updatedAt: string;
}

interface Question {
    id: string;
    text: string;
    imageUrl?: string;
    type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
    options?: string[];
    correctAnswer: string;
    points: number;
}

const QuizzesPage = () => {
    const t = useTranslations("dashboard.teacher.pages");
    const tCommon = useTranslations("common");
    const locale = useLocale() as Locale;

    const router = useNavigationRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const fetchQuizzes = async () => {
        try {
            const response = await fetch("/api/teacher/quizzes");
            if (response.ok) {
                const data = await response.json();
                setQuizzes(data);
            }
        } catch (error) {
            console.error("Error fetching quizzes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteQuiz = async (quiz: Quiz) => {
        if (!confirm(t("deleteQuizConfirmSimple"))) {
            return;
        }

        setIsDeleting(quiz.id);
        try {
            const response = await fetch(`/api/courses/${quiz.courseId}/quizzes/${quiz.id}`, {
                method: "DELETE",
            });

            if (response.ok) {
                toast.success(t("deleteQuizSuccess"));
                fetchQuizzes();
            } else {
                toast.error(t("deleteQuizErrorGeneric"));
            }
        } catch (error) {
            console.error("Error deleting quiz:", error);
            toast.error(t("deleteQuizErrorGeneric"));
        } finally {
            setIsDeleting(null);
        }
    };

    const handleViewQuiz = (quiz: Quiz) => {
        router.push(`/dashboard/teacher/quizzes/${quiz.id}`);
    };

    const filteredQuizzes = quizzes.filter(quiz =>
        quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quiz.course.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="p-6">
                <div className="text-center">{tCommon("loading")}</div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {t("manageQuizzes")}
                </h1>
                <Button onClick={() => router.push("/dashboard/teacher/quizzes/create")} className="bg-brand hover:bg-brand/90 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    {t("createNewQuiz")}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("quizzesCardTitle")}</CardTitle>
                    <div className="flex items-center space-x-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t("searchQuizzes")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">{t("quizTitleCol")}</TableHead>
                                <TableHead className="text-right">{tCommon("course")}</TableHead>
                                <TableHead className="text-right">{t("position")}</TableHead>
                                <TableHead className="text-right">{tCommon("status")}</TableHead>
                                <TableHead className="text-right">{t("questionCountCol")}</TableHead>
                                <TableHead className="text-right">{tCommon("createdAtLabel")}</TableHead>
                                <TableHead className="text-right">{tCommon("actions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredQuizzes.map((quiz) => (
                                <TableRow key={quiz.id}>
                                    <TableCell className="font-medium">
                                        {localizedField(quiz as unknown as Record<string, unknown>, "title", locale)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {localizedField(quiz.course as unknown as Record<string, unknown>, "title", locale)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            {quiz.position}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={quiz.isPublished ? "default" : "secondary"}>
                                            {quiz.isPublished ? tCommon("published") : tCommon("draft")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            {tCommon("questionCount", { count: quiz.questions.length })}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {new Date(quiz.createdAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            <Button 
                                                size="sm" 
                                                className="bg-brand hover:bg-brand/90 text-white"
                                                onClick={() => handleViewQuiz(quiz)}
                                            >
                                                <Eye className="h-4 w-4" />{tCommon("view")}</Button>
                                            <Button 
                                                size="sm" 
                                                className="bg-brand hover:bg-brand/90 text-white"
                                                onClick={() => router.push(`/dashboard/teacher/quizzes/${quiz.id}/edit`)}
                                            >
                                                <Edit className="h-4 w-4" />{tCommon("edit")}</Button>
                                            <Button 
                                                size="sm" 
                                                variant={quiz.isPublished ? "destructive" : "default"}
                                                className={!quiz.isPublished ? "bg-brand hover:bg-brand/90 text-white" : ""}
                                                onClick={async () => {
                                                    try {
                                                        const response = await fetch(`/api/teacher/quizzes/${quiz.id}/publish`, {
                                                            method: "PATCH",
                                                            headers: {
                                                                "Content-Type": "application/json",
                                                            },
                                                            body: JSON.stringify({
                                                                isPublished: !quiz.isPublished
                                                            }),
                                                        });
                                                        if (response.ok) {
                                                            toast.success(quiz.isPublished ? t("unpublishSuccess") : t("publishSuccess"));
                                                            fetchQuizzes();
                                                        }
                                                    } catch (error) {
                                                        toast.error(t("genericError"));
                                                    }
                                                }}
                                            >
                                                {quiz.isPublished ? tCommon("unpublish") : tCommon("publish")}
                                            </Button>

                                            <Button 
                                                size="sm" 
                                                variant="destructive"
                                                onClick={() => handleDeleteQuiz(quiz)}
                                                disabled={isDeleting === quiz.id}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                {isDeleting === quiz.id ? tCommon("deleting") : tCommon("delete")}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default QuizzesPage; 