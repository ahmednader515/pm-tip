"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Award } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import { localizedField } from "@/lib/localized";
import {
    parseMatchingCorrect,
    parseMatchingOptions,
    type MatchingOptions,
} from "@/lib/quiz-question";
import { getMatchingDisplay } from "@/components/quiz/matching-question";

interface QuizAnswer {
    questionId: string;
    studentAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    pointsEarned: number;
    question: {
        text: string;
        textEn?: string | null;
        type: string;
        points: number;
        options?: string | MatchingOptions | null;
        optionsEn?: string | MatchingOptions | null;
        imageUrl?: string | null;
        explanation?: string | null;
        explanationEn?: string | null;
    };
}

interface QuizResult {
    id: string;
    score: number;
    totalPoints: number;
    percentage: number;
    submittedAt: string;
    attemptNumber: number;
    answers: QuizAnswer[];
}

interface Quiz {
    id: string;
    title: string;
    maxAttempts: number;
    currentAttempt: number;
    previousAttempts: number;
}

export default function QuizResultPage({
    params,
}: {
    params: Promise<{ courseId: string; quizId: string }>;
}) {
    const router = useRouter();
    const { courseId, quizId } = use(params);
    const t = useTranslations("quiz");
    const tCommon = useTranslations("common");
    const locale = useLocale() as Locale;
    const [result, setResult] = useState<QuizResult | null>(null);
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [willRedirectToDashboard, setWillRedirectToDashboard] = useState(false);

    useEffect(() => {
        fetchResult();
        fetchQuiz();
        checkNextContent();
    }, [quizId]);

    const checkNextContent = async () => {
        try {
            const contentResponse = await fetch(`/api/courses/${courseId}/content`);
            if (contentResponse.ok) {
                const allContent = await contentResponse.json();
                
                // Find the current quiz in the content array
                const currentIndex = allContent.findIndex((content: any) => 
                    content.id === quizId && content.type === 'quiz'
                );
                
                // If no next content, set flag to show dashboard button
                if (currentIndex === -1 || currentIndex >= allContent.length - 1) {
                    setWillRedirectToDashboard(true);
                }
            } else {
                setWillRedirectToDashboard(true);
            }
        } catch (error) {
            console.error("Error checking next content:", error);
            setWillRedirectToDashboard(true);
        }
    };

    const fetchResult = async () => {
        try {
            const response = await fetch(`/api/courses/${courseId}/quizzes/${quizId}/result`);
            if (response.ok) {
                const data = await response.json();
                setResult(data);
            } else {
                console.error("Error fetching result");
            }
        } catch (error) {
            console.error("Error fetching result:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchQuiz = async () => {
        try {
            const response = await fetch(`/api/courses/${courseId}/quizzes/${quizId}/info`);
            if (response.ok) {
                const data = await response.json();
                setQuiz(data);
            } else {
                console.error("Error fetching quiz info");
            }
        } catch (error) {
            console.error("Error fetching quiz:", error);
        }
    };

    const getGradeColor = (percentage: number) => {
        if (percentage >= 90) return "text-primary";
        if (percentage >= 80) return "text-primary/90";
        if (percentage >= 70) return "text-primary/80";
        if (percentage >= 60) return "text-amber-600";
        return "text-destructive";
    };

    const handleTryAgain = () => {
        router.push(`/courses/${courseId}/quizzes/${quizId}`);
    };

    const handleNextChapter = async () => {
        try {
            // Get all course content (chapters and quizzes) sorted by position
            const contentResponse = await fetch(`/api/courses/${courseId}/content`);
            if (contentResponse.ok) {
                const allContent = await contentResponse.json();
                
                // Find the current quiz in the content array
                const currentIndex = allContent.findIndex((content: any) => 
                    content.id === quizId && content.type === 'quiz'
                );
                
                 if (currentIndex !== -1 && currentIndex < allContent.length - 1) {
                     const nextContent = allContent[currentIndex + 1];
                     if (nextContent.type === 'chapter') {
                         router.push(`/courses/${courseId}/chapters/${nextContent.id}`);
                     } else if (nextContent.type === 'quiz') {
                         router.push(`/courses/${courseId}/quizzes/${nextContent.id}`);
                     } else if (nextContent.type === 'certificate') {
                         router.push(`/courses/${courseId}/certificate`);
                     }
                 } else {
                     // If no next content, go to dashboard
                     router.push(`/dashboard`);
                 }
                         } else {
                 // Fallback to dashboard
                 router.push(`/dashboard`);
             }
         } catch (error) {
             console.error("Error navigating to next chapter:", error);
             // Fallback to dashboard
             router.push(`/dashboard`);
         }
    };

    const canRetakeQuiz = quiz && result && (result.attemptNumber < quiz.maxAttempts);

    const formatMatchingLines = (
        answer: string,
        options?: string | MatchingOptions | null,
        optionsEn?: string | MatchingOptions | null
    ): string[] => {
        const map = parseMatchingCorrect(answer);
        const matching = parseMatchingOptions(options);
        const matchingEn = parseMatchingOptions(optionsEn);
        const display = getMatchingDisplay(matching, matchingEn, locale);
        const promptLabel = (p: string) => {
            const i = matching.prompts.indexOf(p);
            return i >= 0 ? display.promptsDisplay[i] : p;
        };
        const answerLabel = (a: string) => {
            const i = matching.answers.indexOf(a);
            return i >= 0 ? display.answersDisplay[i] : a;
        };
        return Object.entries(map).map(
            ([prompt, ans]) => `${promptLabel(prompt)} → ${answerLabel(ans)}`
        );
    };

    const formatAnswer = (
        answer: string,
        questionType: string,
        question?: QuizAnswer["question"]
    ): string | string[] => {
        if (questionType === "TRUE_FALSE") {
            return answer === "true" ? tCommon("true") : tCommon("false");
        }
        if (questionType === "MULTIPLE_CHOICE" || questionType === "DROPDOWN") {
            try {
                const parsed = JSON.parse(answer);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.join(locale === "ar" ? "، " : ", ");
                }
            } catch {
                // single value (DROPDOWN correctAnswer is often a plain string)
            }
            return answer;
        }
        if (questionType === "MATCHING") {
            return formatMatchingLines(answer, question?.options, question?.optionsEn);
        }
        return answer;
    };

    const renderFormattedAnswer = (
        answer: string,
        questionType: string,
        question?: QuizAnswer["question"],
        className?: string
    ) => {
        const formatted = formatAnswer(answer, questionType, question);
        if (Array.isArray(formatted)) {
            if (formatted.length === 0) return <p className={className}>{answer || "—"}</p>;
            return (
                <ul className={`list-none space-y-1 ${className || ""}`}>
                    {formatted.map((line, i) => (
                        <li key={i} className="auto-dir">{line}</li>
                    ))}
                </ul>
            );
        }
        return <p className={className}>{formatted}</p>;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">{t("resultNotFound")}</h1>
                    <Button onClick={() => router.back()}>{t("goBack")}</Button>
                </div>
            </div>
        );
    }

    const correctAnswers = result.answers.filter(a => a.isCorrect).length;
    const incorrectAnswers = result.answers.filter(a => !a.isCorrect).length;

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold">{t("resultTitle")}</h1>
                    </div>

                    {/* Summary Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Award className="h-5 w-5" />
                                {t("resultSummary")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-primary">
                                        {result.score}/{result.totalPoints}
                                    </div>
                                    <div className="text-sm text-muted-foreground">{t("score")}</div>
                                </div>
                                <div className="text-center">
                                    <div className={`text-2xl font-bold ${getGradeColor(result.percentage)}`}>
                                        {result.percentage.toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-muted-foreground">{t("percentage")}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-primary">
                                        {correctAnswers}
                                    </div>
                                    <div className="text-sm text-muted-foreground">{t("correctAnswers")}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-destructive">
                                        {incorrectAnswers}
                                    </div>
                                    <div className="text-sm text-muted-foreground">{t("incorrectAnswers")}</div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{t("overallProgress")}</span>
                                    <span className="text-sm font-medium">{result.percentage.toFixed(1)}%</span>
                                </div>
                                <Progress value={result.percentage} className="w-full" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Detailed Answers */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("answerDetails")}</CardTitle>
                            <CardDescription>
                                {t("answerDetailsDesc")}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {result.answers.map((answer, index) => (
                                    <div key={answer.questionId} className="border rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-medium">{t("questionN", { n: index + 1 })}</h4>
                                            <div className="flex items-center gap-2">
                                                {answer.isCorrect ? (
                                                    <CheckCircle className="h-4 w-4 text-primary" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-destructive" />
                                                )}
                                                <Badge variant={answer.isCorrect ? "secondary" : "destructive"}>
                                                    {answer.isCorrect ? t("correctBadge") : t("incorrectBadge")}
                                                </Badge>
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2 auto-dir">
                                            {localizedField(
                                                answer.question as unknown as Record<string, unknown>,
                                                "text",
                                                locale
                                            )}
                                        </p>
                                        {answer.question.imageUrl && (
                                            <div className="mb-3">
                                                <img
                                                    src={answer.question.imageUrl}
                                                    alt={t("questionImageAlt")}
                                                    className="rounded-md border object-contain max-h-64"
                                                />
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="font-medium">{t("yourAnswer")}</span>
                                                {answer.studentAnswer ? (
                                                    renderFormattedAnswer(
                                                        answer.studentAnswer,
                                                        answer.question.type,
                                                        answer.question,
                                                        "text-muted-foreground"
                                                    )
                                                ) : (
                                                    <p className="text-muted-foreground">{t("noAnswer")}</p>
                                                )}
                                            </div>
                                            <div>
                                                <span className="font-medium">{t("correctAnswerColon")}</span>
                                                {renderFormattedAnswer(
                                                    answer.correctAnswer,
                                                    answer.question.type,
                                                    answer.question,
                                                    "text-primary"
                                                )}
                                            </div>
                                        </div>
                                        {localizedField(
                                            answer.question as unknown as Record<string, unknown>,
                                            "explanation",
                                            locale
                                        ).trim() && (
                                            <div className="mt-3 pt-3 border-t">
                                                <span className="font-medium text-muted-foreground">{t("explanationColon")}</span>
                                                <p className="text-sm mt-1 auto-dir">
                                                    {localizedField(
                                                        answer.question as unknown as Record<string, unknown>,
                                                        "explanation",
                                                        locale
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                        <div className="mt-2 text-sm">
                                            <span className="font-medium">{t("pointsColon")}</span>
                                            <span className="text-muted-foreground">
                                                {" "}{answer.pointsEarned}/{answer.question.points}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex justify-center gap-4 flex-wrap">
                        {canRetakeQuiz ? (
                            <Button
                                onClick={handleTryAgain}
                                className="bg-primary hover:bg-primary/90"
                            >
                                {t("retakeQuizBtn")}
                            </Button>
                        ) : (
                            <Button
                                onClick={handleNextChapter}
                                className="bg-primary hover:bg-primary/90"
                            >
                                {willRedirectToDashboard ? t("dashboard") : t("nextChapter")}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 