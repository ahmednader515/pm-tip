"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Clock, CheckCircle, AlertCircle, Save } from "lucide-react";
import { parseQuizOptions } from "@/lib/utils";

interface Question {
    id: string;
    text: string;
    type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
    options?: string[] | string;
    correctAnswer: string;
    points: number;
    imageUrl?: string;
}

interface Quiz {
    id: string;
    title: string;
    description: string;
    timer?: number; // Timer in minutes
    maxAttempts: number;
    currentAttempt?: number;
    previousAttempts?: number;
    questions: Question[];
}

interface QuizAnswer {
    questionId: string;
    answer: string;
}

export default function QuizPage({
    params,
}: {
    params: Promise<{ courseId: string; quizId: string }>;
}) {
    const router = useRouter();
    const { courseId, quizId } = use(params);
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [answers, setAnswers] = useState<QuizAnswer[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [navigation, setNavigation] = useState<{
        nextContentId: string | null;
        previousContentId: string | null;
        nextContentType: 'chapter' | 'quiz' | null;
        previousContentType: 'chapter' | 'quiz' | null;
    } | null>(null);
    const [redirectToResult, setRedirectToResult] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const saveDraftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        fetchQuiz();
        fetchNavigation();
    }, [quizId]);

    useEffect(() => {
        if (redirectToResult) {
            router.push(`/courses/${courseId}/quizzes/${quizId}/result`);
        }
    }, [redirectToResult, courseId, quizId, router]);

    useEffect(() => {
        return () => {
            if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (quiz?.timer != null && timeLeft > 0) {
            const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(t);
        }
        if (quiz?.timer != null && timeLeft === 0 && quiz) {
            handleSubmit();
        }
    }, [timeLeft, quiz?.timer]);

    const fetchQuiz = async () => {
        try {
            const response = await fetch(`/api/courses/${courseId}/quizzes/${quizId}`);
            if (response.ok) {
                const data = await response.json();
                setQuiz(data);
                // No time limit when timer is null/undefined
                setTimeLeft(data.timer != null ? data.timer * 60 : -1);
                // Load saved draft if any
                const draftRes = await fetch(`/api/courses/${courseId}/quizzes/${quizId}/draft`);
                if (draftRes.ok) {
                    const draftData = await draftRes.json();
                    if (draftData.answers?.length) {
                        setAnswers(draftData.answers);
                    }
                }
            } else {
                const errorText = await response.text();
                if (errorText.includes("Maximum attempts reached")) {
                    toast.error("لقد استنفذت جميع المحاولات المسموحة لهذا الاختبار");
                    // Set flag to redirect to result page when no attempts remaining
                    setRedirectToResult(true);
                } else {
                    toast.error("حدث خطأ أثناء تحميل الاختبار");
                }
            }
        } catch (error) {
            console.error("Error fetching quiz:", error);
            toast.error("حدث خطأ أثناء تحميل الاختبار");
        } finally {
            setLoading(false);
        }
    };

    const fetchNavigation = async () => {
        try {
            const response = await fetch(`/api/courses/${courseId}/quizzes/${quizId}/navigation`);
            if (response.ok) {
                const data = await response.json();
                setNavigation(data);
            }
        } catch (error) {
            console.error("Error fetching navigation:", error);
        }
    };

    const saveDraft = async (answersToSave: QuizAnswer[], showToast = false) => {
        if (!courseId || !quizId || answersToSave.length === 0) return;
        setSavingDraft(true);
        try {
            const res = await fetch(`/api/courses/${courseId}/quizzes/${quizId}/draft`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers: answersToSave }),
            });
            if (res.ok) {
                setLastSavedAt(new Date());
                if (showToast) toast.success("تم حفظ الإجابات");
            }
        } catch {
            if (showToast) toast.error("فشل حفظ الإجابات");
        } finally {
            setSavingDraft(false);
        }
    };

    const handleAnswerChange = (questionId: string, answer: string) => {
        setAnswers(prev => {
            const next = (() => {
                const existing = prev.find(a => a.questionId === questionId);
                if (existing) {
                    return prev.map(a => a.questionId === questionId ? { ...a, answer } : a);
                }
                return [...prev, { questionId, answer }];
            })();
            // Debounced auto-save when student chooses an option
            if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
            saveDraftTimeoutRef.current = setTimeout(() => saveDraft(next), 1500);
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!quiz) return;

        setSubmitting(true);
        try {
            const response = await fetch(`/api/courses/${courseId}/quizzes/${quizId}/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ answers }),
            });

            if (response.ok) {
                const result = await response.json();
                toast.success("تم إرسال الاختبار بنجاح!");
                router.push(`/courses/${courseId}/quizzes/${quizId}/result`);
            } else {
                const error = await response.text();
                toast.error(error || "حدث خطأ أثناء إرسال الاختبار");
            }
        } catch (error) {
            console.error("Error submitting quiz:", error);
            toast.error("حدث خطأ أثناء إرسال الاختبار");
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const onNext = () => {
        if (navigation?.nextContentId) {
            if (navigation.nextContentType === 'chapter') {
                router.push(`/courses/${courseId}/chapters/${navigation.nextContentId}`);
            } else if (navigation.nextContentType === 'quiz') {
                router.push(`/courses/${courseId}/quizzes/${navigation.nextContentId}`);
            }
            router.refresh();
        }
    };

    const onPrevious = () => {
        if (navigation?.previousContentId) {
            if (navigation.previousContentType === 'chapter') {
                router.push(`/courses/${courseId}/chapters/${navigation.previousContentId}`);
            } else if (navigation.previousContentType === 'quiz') {
                router.push(`/courses/${courseId}/quizzes/${navigation.previousContentId}`);
            }
            router.refresh();
        }
    };

    if (loading && !redirectToResult) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (redirectToResult) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">جاري تحميل النتيجة...</p>
                </div>
            </div>
        );
    }

    if (!quiz) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">الاختبار غير موجود</h1>
                    <Button onClick={() => router.back()}>العودة</Button>
                </div>
            </div>
        );
    }

    const currentQuestionData = quiz.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => router.back()}
                                className="flex items-center gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                رجوع
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={savingDraft || answers.length === 0}
                                onClick={() => saveDraft(answers, true)}
                                className="flex items-center gap-2"
                            >
                                <Save className="h-4 w-4" />
                                {savingDraft ? "جاري الحفظ..." : "حفظ الإجابات"}
                            </Button>
                            {lastSavedAt && !savingDraft && (
                                <span className="text-xs text-muted-foreground">
                                    آخر حفظ: {lastSavedAt.toLocaleTimeString("ar-SA")}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            {quiz.timer != null && timeLeft >= 0 && (
                                <div className="flex items-center gap-2 text-primary">
                                    <Clock className="h-4 w-4" />
                                    <span className="font-medium">{formatTime(timeLeft)}</span>
                                </div>
                            )}
                            <Badge variant="secondary">
                                السؤال {currentQuestion + 1} من {quiz.questions.length}
                            </Badge>
                            {quiz.maxAttempts > 1 && (
                                <Badge variant="outline">
                                    المحاولة {quiz.currentAttempt || 1} من {quiz.maxAttempts}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Quiz Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{quiz.title}</CardTitle>
                            <CardDescription>{quiz.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="w-full bg-muted rounded-full h-2">
                                <div 
                                    className="bg-primary h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Question */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                السؤال {currentQuestion + 1}
                                <Badge variant="outline">{currentQuestionData.points} درجة</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="text-lg">{currentQuestionData.text}</div>

                            {/* Question Image */}
                            {currentQuestionData.imageUrl && (
                                <div className="flex justify-center">
                                    <img 
                                        src={currentQuestionData.imageUrl} 
                                        alt="Question" 
                                        className="max-w-full h-auto max-h-96 rounded-lg border shadow-sm"
                                    />
                                </div>
                            )}

                            {currentQuestionData.type === "MULTIPLE_CHOICE" && (
                                <RadioGroup
                                    value={answers.find(a => a.questionId === currentQuestionData.id)?.answer || ""}
                                    onValueChange={(value) => handleAnswerChange(currentQuestionData.id, value)}
                                >
                                    {(Array.isArray(currentQuestionData.options) ? currentQuestionData.options : parseQuizOptions(currentQuestionData.options || null)).map((option: string, index: number) => (
                                        <div key={index} className="flex items-center space-x-2">
                                            <RadioGroupItem value={option} id={`option-${index}`} />
                                            <Label htmlFor={`option-${index}`}>{option}</Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            )}

                            {currentQuestionData.type === "TRUE_FALSE" && (
                                <RadioGroup
                                    value={answers.find(a => a.questionId === currentQuestionData.id)?.answer || ""}
                                    onValueChange={(value) => handleAnswerChange(currentQuestionData.id, value)}
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="true" id="true" />
                                        <Label htmlFor="true">صح</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="false" id="false" />
                                        <Label htmlFor="false">خطأ</Label>
                                    </div>
                                </RadioGroup>
                            )}

                            {currentQuestionData.type === "SHORT_ANSWER" && (
                                <Textarea
                                    placeholder="اكتب إجابتك هنا..."
                                    value={answers.find(a => a.questionId === currentQuestionData.id)?.answer || ""}
                                    onChange={(e) => handleAnswerChange(currentQuestionData.id, e.target.value)}
                                    rows={4}
                                />
                            )}
                        </CardContent>
                    </Card>

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                        <Button
                            variant="outline"
                            onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                            disabled={currentQuestion === 0}
                        >
                            السابق
                        </Button>

                        <div className="flex items-center gap-2">
                            {currentQuestion === quiz.questions.length - 1 ? (
                                <Button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="bg-primary hover:bg-primary/90"
                                >
                                    {submitting ? "جاري الإرسال..." : "إنهاء الاختبار"}
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => setCurrentQuestion(currentQuestion + 1)}
                                    className="bg-primary hover:bg-primary/90"
                                >
                                    التالي
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Warning */}
                    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                                <AlertCircle className="h-5 w-5" />
                                <span className="font-medium">تنبيه</span>
                            </div>
                            <p className="text-amber-700 dark:text-amber-200 mt-2">
                                {quiz.maxAttempts > 1 
                                    ? `تأكد من إجابة جميع الأسئلة قبل إنهاء الاختبار. يمكنك إعادة الاختبار ${quiz.maxAttempts - (quiz.currentAttempt || 1)} مرات أخرى.`
                                    : "تأكد من إجابة جميع الأسئلة قبل إنهاء الاختبار. لا يمكنك العودة للاختبار بعد الإرسال."
                                }
                            </p>
                        </CardContent>
                    </Card>

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between mt-8">
                        <Button
                            variant="outline"
                            onClick={onPrevious}
                            disabled={!navigation?.previousContentId}
                            className="flex items-center gap-2"
                        >
                            المحتوى السابق
                        </Button>

                        <Button
                            onClick={onNext}
                            disabled={!navigation?.nextContentId}
                            className="flex items-center gap-2"
                        >
                            المحتوى التالي
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
} 