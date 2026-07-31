"use client";

import { useLocale, useTranslations } from "next-intl";
import { ar, enUS } from "date-fns/locale";

import { useState, useEffect, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ArrowLeft, Eye, Download, Filter } from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

interface QuizResult {
    id: string;
    studentId: string;
    quizId: string;
    score: number;
    totalPoints: number;
    submittedAt: string;
    user: {
        fullName: string;
        phoneNumber: string;
    };
    quiz: {
        title: string;
        course: {
            id: string;
            title: string;
        };
    };
    answers: QuizAnswer[];
}

interface QuizAnswer {
    id: string;
    questionId: string;
    answer: string;
    isCorrect: boolean;
    points: number;
    question: {
        text: string;
        type: string;
        points: number;
    };
}

const QuizResultsContent = () => {
    const t = useTranslations("dashboard.teacher.pages");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const dateLocale = locale === "ar" ? ar : enUS;

    const router = useRouter();
    const searchParams = useSearchParams();
    const quizId = searchParams.get('quizId');
    
    const [results, setResults] = useState<QuizResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [quizDetails, setQuizDetails] = useState<any>(null);
    const [filteredResults, setFilteredResults] = useState<QuizResult[]>([]);

    useEffect(() => {
        if (quizId) {
            fetchQuizResults();
            fetchQuizDetails();
        } else {
            toast.error(t("quizNotSpecified"));
            router.push("/dashboard/teacher/quizzes");
        }
    }, [quizId]);

    useEffect(() => {
        // Filter results based on search term
        let filtered = results;
        
        if (searchTerm) {
            filtered = filtered.filter(result =>
                result.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                result.user.phoneNumber.includes(searchTerm)
            );
        }
        
        setFilteredResults(filtered);
    }, [results, searchTerm]);

    const fetchQuizResults = async () => {
        try {
            const response = await fetch(`/api/teacher/quiz-results?quizId=${quizId}`);
            if (response.ok) {
                const data = await response.json();
                setResults(data);
            } else {
                toast.error(t("loadResultsError"));
            }
        } catch (error) {
            console.error("Error fetching quiz results:", error);
            toast.error(t("loadResultsError"));
        } finally {
            setLoading(false);
        }
    };

    const fetchQuizDetails = async () => {
        try {
            const response = await fetch(`/api/teacher/quizzes/${quizId}`);
            if (response.ok) {
                const data = await response.json();
                setQuizDetails(data);
            }
        } catch (error) {
            console.error("Error fetching quiz details:", error);
        }
    };

    const handleViewDetails = (result: QuizResult) => {
        router.push(`/dashboard/teacher/quiz-results/${result.id}`);
    };

    const calculatePercentage = (score: number, totalPoints: number) => {
        return totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    };

    const getGradeColor = (percentage: number) => {
        if (percentage >= 90) return "text-green-600";
        if (percentage >= 80) return "text-blue-600";
        if (percentage >= 70) return "text-yellow-600";
        if (percentage >= 60) return "text-orange-600";
        return "text-red-600";
    };

    const getGradeBadge = (percentage: number) => {
        if (percentage >= 90) return { variant: "default" as const, text: t("gradeExcellent") };
        if (percentage >= 80) return { variant: "default" as const, text: t("gradeVeryGood") };
        if (percentage >= 70) return { variant: "secondary" as const, text: t("gradeGood") };
        if (percentage >= 60) return { variant: "outline" as const, text: t("gradePass") };
        return { variant: "destructive" as const, text: t("gradeWeak") };
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="text-center">{tCommon("loading")}</div>
            </div>
        );
    }

    if (!quizId) {
        return (
            <div className="p-6">
                <div className="text-center">{t("quizNotSpecified")}</div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button
                        variant="outline"
                        onClick={() => router.push("/dashboard/teacher/quizzes")}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />{tCommon("back")}</Button>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {t("quizResultsNamed", { title: quizDetails?.title || tCommon("loading") })}
                    </h1>
                </div>
            </div>

            {quizDetails && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t("quizInfo")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <h4 className="font-medium mb-1">{t("quizTitleCol")}</h4>
                                <p className="text-sm text-muted-foreground">{quizDetails.title}</p>
                            </div>
                            <div>
                                <h4 className="font-medium mb-1">{tCommon("course")}</h4>
                                <p className="text-sm text-muted-foreground">{quizDetails.course?.title}</p>
                            </div>
                            <div>
                                <h4 className="font-medium mb-1">{t("questionCountCol")}</h4>
                                <Badge variant="secondary">
                                    {tCommon("questionCount", { count: quizDetails.questions?.length || 0 })}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t("totalResultsLabel")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{results.length}</div>
                        <p className="text-xs text-muted-foreground">{t("resultSingular")}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t("averageScore")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {results.length > 0 
                                ? Math.round(results.reduce((sum, r) => sum + calculatePercentage(r.score, r.totalPoints), 0) / results.length)
                                : 0
                            }%
                        </div>
                        <p className="text-xs text-muted-foreground">{t("averageShort")}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t("highest")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {results.length > 0 
                                ? Math.max(...results.map(r => calculatePercentage(r.score, r.totalPoints)))
                                : 0
                            }%
                        </div>
                        <p className="text-xs text-muted-foreground">{t("bestResult")}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t("lowestScore")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {results.length > 0 
                                ? Math.min(...results.map(r => calculatePercentage(r.score, r.totalPoints)))
                                : 0
                            }%
                        </div>
                        <p className="text-xs text-muted-foreground">{t("worstResult")}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("studentResults")}</CardTitle>
                    <div className="flex items-center space-x-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t("searchInStudents")}
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
                                <TableHead className="text-right">{tCommon("studentLabel")}</TableHead>
                                <TableHead className="text-right">{tCommon("score")}</TableHead>
                                <TableHead className="text-right">{t("percentageCol")}</TableHead>
                                <TableHead className="text-right">{t("gradeCol")}</TableHead>
                                <TableHead className="text-right">{t("submittedDate")}</TableHead>
                                <TableHead className="text-right">{tCommon("actions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredResults.map((result) => {
                                const percentage = calculatePercentage(result.score, result.totalPoints);
                                const grade = getGradeBadge(percentage);
                                
                                return (
                                    <TableRow key={result.id}>
                                        <TableCell className="font-medium">
                                            <div>
                                                <div>{result.user.fullName}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {result.user.phoneNumber}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">
                                                {result.score} / {result.totalPoints}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className={`font-medium ${getGradeColor(percentage)}`}>
                                                {percentage}%
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={grade.variant}>
                                                {grade.text}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm text-muted-foreground">
                                                {new Date(result.submittedAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(result.submittedAt).toLocaleTimeString("ar-EG")}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleViewDetails(result)}
                                            >
                                                <Eye className="h-4 w-4 mr-2" />
                                                {t("details")}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    
                    {filteredResults.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">{t("noResultsToShow")}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

const QuizResultsPage = () => {
    return (
        <Suspense fallback={
            <div className="p-6">
                <div className="text-center">{tCommon("loading")}</div>
            </div>
        }>
            <QuizResultsContent />
        </Suspense>
    );
};

export default QuizResultsPage; 