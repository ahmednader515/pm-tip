"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Clock, AlertCircle, Save, Eye, Languages } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
    answer: string; // for MULTIPLE_CHOICE: JSON array of selected option strings; else single string
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
    const [revealedCorrect, setRevealedCorrect] = useState<Record<string, string>>({});
    const [revealedCorrectTranslated, setRevealedCorrectTranslated] = useState<Record<string, string>>({});
    const [loadingCorrectId, setLoadingCorrectId] = useState<string | null>(null);
    const [translating, setTranslating] = useState(false);
    const [translatedQuiz, setTranslatedQuiz] = useState<{
        questions: { text: string; options?: string[] }[];
    } | null>(null);

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

    // When in translated view, translate any revealed correct answers that aren't translated yet
    useEffect(() => {
        if (!translatedQuiz) return;
        const toTranslate = Object.entries(revealedCorrect).filter(
            ([id, text]) => text && !revealedCorrectTranslated[id]
        );
        if (toTranslate.length === 0) return;
        (async () => {
            for (const [questionId, text] of toTranslate) {
                try {
                    const res = await fetch("/api/translate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ texts: [text] }),
                    });
                    if (res.ok) {
                        const { translations } = await res.json();
                        if (Array.isArray(translations) && translations[0]) {
                            setRevealedCorrectTranslated((prev) => ({ ...prev, [questionId]: translations[0] }));
                        }
                    }
                } catch {
                    // keep original
                }
            }
        })();
    }, [translatedQuiz, revealedCorrect]);

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
            if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
            saveDraftTimeoutRef.current = setTimeout(() => saveDraft(next), 1500);
            return next;
        });
    };

    const fetchCorrectAnswer = async (questionId: string) => {
        setLoadingCorrectId(questionId);
        try {
            const res = await fetch(
                `/api/courses/${courseId}/quizzes/${quizId}/correct-answer?questionId=${encodeURIComponent(questionId)}`
            );
            if (res.ok) {
                const data = await res.json();
                setRevealedCorrect((prev) => ({ ...prev, [questionId]: data.correctAnswer }));
            } else {
                toast.error("تعذر تحميل الإجابة الصحيحة");
            }
        } catch {
            toast.error("تعذر تحميل الإجابة الصحيحة");
        } finally {
            setLoadingCorrectId(null);
        }
    };

    const handleTranslateQuiz = async () => {
        if (!quiz || translating) return;
        setTranslating(true);
        try {
            const texts: string[] = [];
            quiz.questions.forEach((q) => {
                texts.push(q.text);
                if (q.options) {
                    const opts = Array.isArray(q.options) ? q.options : parseQuizOptions(q.options);
                    opts.forEach((o) => texts.push(o));
                }
            });
            if (texts.length === 0) {
                toast.info("لا يوجد نص للترجمة");
                setTranslating(false);
                return;
            }
            const res = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texts }),
            });
            if (!res.ok) throw new Error("Translate failed");
            const { translations } = await res.json();
            if (!Array.isArray(translations) || translations.length !== texts.length) throw new Error("Invalid response");
            let idx = 0;
            const questions = quiz.questions.map((q) => {
                const text = translations[idx++] ?? q.text;
                let options: string[] | undefined;
                if (q.options) {
                    const opts = Array.isArray(q.options) ? q.options : parseQuizOptions(q.options);
                    options = opts.map(() => translations[idx++] ?? "");
                }
                return { text, options };
            });
            setTranslatedQuiz({ questions });
            toast.success("تمت الترجمة إلى الإنجليزية");
        } catch {
            toast.error("فشل في الترجمة. حاول مرة أخرى لاحقاً.");
        } finally {
            setTranslating(false);
        }
    };

    const handleMultipleChoiceToggle = (questionId: string, optionText: string) => {
        setAnswers(prev => {
            const existing = prev.find(a => a.questionId === questionId);
            let current: string[] = [];
            if (existing?.answer) {
                try {
                    const parsed = JSON.parse(existing.answer);
                    current = Array.isArray(parsed) ? parsed.filter((x: unknown) => typeof x === "string") : [existing.answer];
                } catch {
                    current = [existing.answer];
                }
            }
            const set = new Set(current);
            if (set.has(optionText)) set.delete(optionText);
            else set.add(optionText);
            const nextArr = Array.from(set);
            const nextAnswer = JSON.stringify(nextArr);
            const next = existing
                ? prev.map(a => a.questionId === questionId ? { ...a, answer: nextAnswer } : a)
                : [...prev, { questionId, answer: nextAnswer }];
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
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={translating || !quiz}
                                onClick={translatedQuiz ? () => setTranslatedQuiz(null) : handleTranslateQuiz}
                                className="flex items-center gap-2"
                            >
                                <Languages className="h-4 w-4" />
                                {translatedQuiz ? "عرض العربية" : translating ? "جاري الترجمة..." : "ترجمة إلى الإنجليزية"}
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
                            {revealedCorrect[currentQuestionData.id] != null && (
                                <div className="rounded-md bg-muted/80 px-3 py-1.5 text-sm text-muted-foreground inline-flex items-center gap-1">
                                    تم تحديد السؤال — لا يمكن تعديل الإجابة
                                </div>
                            )}
                            <div className="text-lg">
                                {translatedQuiz?.questions[currentQuestion]?.text ?? currentQuestionData.text}
                            </div>

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
                                <div className={`space-y-3 ${revealedCorrect[currentQuestionData.id] != null ? "pointer-events-none opacity-80" : ""}`}>
                                    <p className="text-sm text-muted-foreground">يمكنك اختيار أكثر من إجابة</p>
                                    {(() => {
                                        const opts = translatedQuiz?.questions[currentQuestion]?.options ??
                                            (Array.isArray(currentQuestionData.options) ? currentQuestionData.options : parseQuizOptions(currentQuestionData.options || null));
                                        const origOpts = Array.isArray(currentQuestionData.options) ? currentQuestionData.options : parseQuizOptions(currentQuestionData.options || null);
                                        const isLocked = revealedCorrect[currentQuestionData.id] != null;
                                        return opts.map((option: string, index: number) => {
                                            const origOption = origOpts[index] ?? option;
                                            const raw = answers.find(a => a.questionId === currentQuestionData.id)?.answer ?? "";
                                            let selected = false;
                                            try {
                                                const parsed = JSON.parse(raw);
                                                selected = Array.isArray(parsed) && parsed.includes(origOption);
                                            } catch {
                                                selected = raw === origOption;
                                            }
                                            return (
                                                <div key={index} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`option-${currentQuestionData.id}-${index}`}
                                                        checked={selected}
                                                        disabled={isLocked}
                                                        onCheckedChange={() => handleMultipleChoiceToggle(currentQuestionData.id, origOption)}
                                                    />
                                                    <Label htmlFor={`option-${currentQuestionData.id}-${index}`} className="cursor-pointer flex-1">{option}</Label>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            )}

                            {currentQuestionData.type === "TRUE_FALSE" && (
                                <div className={revealedCorrect[currentQuestionData.id] != null ? "pointer-events-none opacity-80" : ""}>
                                    <RadioGroup
                                        value={answers.find(a => a.questionId === currentQuestionData.id)?.answer || ""}
                                        onValueChange={(value) => handleAnswerChange(currentQuestionData.id, value)}
                                        disabled={revealedCorrect[currentQuestionData.id] != null}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="true" id={`true-${currentQuestionData.id}`} disabled={revealedCorrect[currentQuestionData.id] != null} />
                                            <Label htmlFor={`true-${currentQuestionData.id}`}>صح</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="false" id={`false-${currentQuestionData.id}`} disabled={revealedCorrect[currentQuestionData.id] != null} />
                                            <Label htmlFor={`false-${currentQuestionData.id}`}>خطأ</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                            )}

                            {currentQuestionData.type === "SHORT_ANSWER" && (
                                <Textarea
                                    placeholder="اكتب إجابتك هنا..."
                                    value={answers.find(a => a.questionId === currentQuestionData.id)?.answer || ""}
                                    onChange={(e) => handleAnswerChange(currentQuestionData.id, e.target.value)}
                                    rows={4}
                                    disabled={revealedCorrect[currentQuestionData.id] != null}
                                    className={revealedCorrect[currentQuestionData.id] != null ? "opacity-80" : ""}
                                />
                            )}

                            {/* Show correct answer (after student has answered) */}
                            {answers.some((a) => a.questionId === currentQuestionData.id) && (
                                <div className="pt-2 border-t space-y-2">
                                    {revealedCorrect[currentQuestionData.id] == null ? (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            disabled={loadingCorrectId === currentQuestionData.id}
                                            onClick={() => fetchCorrectAnswer(currentQuestionData.id)}
                                            className="gap-2"
                                        >
                                            <Eye className="h-4 w-4" />
                                            {loadingCorrectId === currentQuestionData.id ? "جاري التحميل..." : "عرض الإجابة الصحيحة"}
                                        </Button>
                                    ) : (
                                        <div className="rounded-md bg-muted p-3 text-sm">
                                            <span className="font-medium text-muted-foreground">
                                                {translatedQuiz ? "Correct answer: " : "الإجابة الصحيحة: "}
                                            </span>
                                            <span>
                                                {translatedQuiz && revealedCorrectTranslated[currentQuestionData.id] != null
                                                    ? revealedCorrectTranslated[currentQuestionData.id]
                                                    : revealedCorrect[currentQuestionData.id]}
                                            </span>
                                        </div>
                                    )}
                                </div>
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