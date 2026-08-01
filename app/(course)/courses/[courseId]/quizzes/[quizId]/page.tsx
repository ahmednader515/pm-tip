"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Clock, AlertCircle, Save, Eye, Languages } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { parseQuizOptions } from "@/lib/utils";
import {
    parseMatchingCorrect,
    parseMatchingOptions,
    type MatchingOptions,
} from "@/lib/quiz-question";
import { getMatchingDisplay, MatchingQuestion } from "@/components/quiz/matching-question";
import {
    type RevealedFeedback,
    revealedFeedbackToState,
} from "@/lib/quiz-draft";
import { useLocale, useTranslations } from "next-intl";
import { localizedField } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

interface Question {
    id: string;
    text: string;
    textEn?: string | null;
    type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "DROPDOWN" | "MATCHING";
    options?: string[] | string | MatchingOptions | null;
    optionsEn?: string[] | string | MatchingOptions | null;
    explanationEn?: string | null;
    points: number;
    imageUrl?: string;
}

function resolveQuestionOptions(question: Question, locale: Locale): string[] {
    const arOpts = Array.isArray(question.options)
        ? question.options
        : parseQuizOptions(typeof question.options === "string" ? question.options : null);
    if (locale !== "en") return arOpts;
    const enOpts = Array.isArray(question.optionsEn)
        ? question.optionsEn
        : parseQuizOptions(typeof question.optionsEn === "string" ? question.optionsEn : null);
    if (!enOpts.length) return arOpts;
    return arOpts.map((opt, i) => (enOpts[i]?.trim() ? enOpts[i] : opt));
}

function resolveQuestionText(question: Question, locale: Locale): string {
    return localizedField(question as unknown as Record<string, unknown>, "text", locale);
}

interface Quiz {
    id: string;
    title: string;
    titleEn?: string | null;
    description: string;
    descriptionEn?: string | null;
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

function hasAnsweredQuestion(
    answers: QuizAnswer[],
    questionId: string,
    questionType: Question["type"]
): boolean {
    const entry = answers.find((a) => a.questionId === questionId);
    if (!entry?.answer?.trim()) return false;
    if (questionType === "MULTIPLE_CHOICE" || questionType === "DROPDOWN") {
        try {
            const parsed = JSON.parse(entry.answer);
            return Array.isArray(parsed) && parsed.length > 0;
        } catch {
            return entry.answer.trim().length > 0;
        }
    }
    if (questionType === "MATCHING") {
        return Object.keys(parseMatchingCorrect(entry.answer)).length > 0;
    }
    return entry.answer.trim().length > 0;
}

export default function QuizPage({
    params,
}: {
    params: Promise<{ courseId: string; quizId: string }>;
}) {
    const router = useRouter();
    const { courseId, quizId } = use(params);
    const t = useTranslations("quiz");
    const tCommon = useTranslations("common");
    const tCourse = useTranslations("course");
    const locale = useLocale() as Locale;
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [answers, setAnswers] = useState<QuizAnswer[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [navigation, setNavigation] = useState<{
        nextContentId: string | null;
        previousContentId: string | null;
        nextContentType: 'chapter' | 'quiz' | 'certificate' | null;
        previousContentType: 'chapter' | 'quiz' | 'certificate' | null;
    } | null>(null);
    const [redirectToResult, setRedirectToResult] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const saveDraftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentQuestionRef = useRef(0);
    const revealedFeedbackRef = useRef<RevealedFeedback>({});
    const answersRef = useRef<QuizAnswer[]>([]);
    const [revealedCorrect, setRevealedCorrect] = useState<Record<string, string>>({});
    const [revealedCorrectTranslated, setRevealedCorrectTranslated] = useState<Record<string, string>>({});
    const [revealedExplanation, setRevealedExplanation] = useState<Record<string, string>>({});
    const [revealedExplanationTranslated, setRevealedExplanationTranslated] = useState<Record<string, string>>({});
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
        currentQuestionRef.current = currentQuestion;
    }, [currentQuestion]);

    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    useEffect(() => {
        return () => {
            if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!translatedQuiz) return;
        const toTranslate = Object.entries(revealedCorrect).filter(
            ([id, text]) => text && !revealedCorrectTranslated[id]
        );
        const toTranslateExpl = Object.entries(revealedExplanation).filter(
            ([id, text]) => text && !revealedExplanationTranslated[id]
        );
        if (toTranslate.length === 0 && toTranslateExpl.length === 0) return;
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
                            setRevealedCorrectTranslated((prev) => ({
                                ...prev,
                                [questionId]: translations[0],
                            }));
                        }
                    }
                } catch {
                    // keep original
                }
            }
            for (const [questionId, text] of toTranslateExpl) {
                try {
                    const res = await fetch("/api/translate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ texts: [text] }),
                    });
                    if (res.ok) {
                        const { translations } = await res.json();
                        if (Array.isArray(translations) && translations[0]) {
                            setRevealedExplanationTranslated((prev) => ({
                                ...prev,
                                [questionId]: translations[0],
                            }));
                        }
                    }
                } catch {
                    // keep original
                }
            }
        })();
    }, [translatedQuiz, revealedCorrect, revealedExplanation]);

    useEffect(() => {
        if (quiz?.timer != null && timeLeft > 0) {
            const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(t);
        }
        if (quiz?.timer != null && timeLeft === 0 && quiz) {
            handleSubmit();
        }
    }, [timeLeft, quiz?.timer]);

    const isQuestionLocked = (questionId: string) =>
        revealedFeedbackRef.current[questionId] != null;

    const applyRevealedFeedback = (feedback: RevealedFeedback) => {
        revealedFeedbackRef.current = feedback;
        const { correct, explanation } = revealedFeedbackToState(feedback);
        setRevealedCorrect(correct);
        setRevealedExplanation(explanation);
    };

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
                    if (draftData.revealedFeedback) {
                        applyRevealedFeedback(draftData.revealedFeedback);
                    }
                    const max = data.questions.length - 1;
                    const idx = draftData.currentQuestionIndex ?? 0;
                    const restored = Math.min(Math.max(0, idx), max);
                    setCurrentQuestion(restored);
                    currentQuestionRef.current = restored;
                }
            } else {
                const errorText = await response.text();
                if (errorText.includes("Maximum attempts reached")) {
                    toast.error(t("noAttempts"));
                    // Set flag to redirect to result page when no attempts remaining
                    setRedirectToResult(true);
                } else {
                    toast.error(t("loadError"));
                }
            }
        } catch (error) {
            console.error("Error fetching quiz:", error);
            toast.error(t("loadError"));
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

    const persistDraft = async (
        answersToSave: QuizAnswer[],
        questionIndex: number,
        showToast = false,
        feedback: RevealedFeedback = revealedFeedbackRef.current
    ) => {
        if (!courseId || !quizId) return;
        setSavingDraft(true);
        try {
            const res = await fetch(`/api/courses/${courseId}/quizzes/${quizId}/draft`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    answers: answersToSave,
                    currentQuestionIndex: questionIndex,
                    revealedFeedback: feedback,
                }),
            });
            if (res.ok) {
                setLastSavedAt(new Date());
                if (showToast) toast.success(t("answersSaved"));
            }
        } catch {
            if (showToast) toast.error(t("saveFailed"));
        } finally {
            setSavingDraft(false);
        }
    };

    const goToQuestion = (index: number) => {
        setCurrentQuestion(index);
        currentQuestionRef.current = index;
        persistDraft(answers, index);
    };

    const handleAnswerChange = (questionId: string, answer: string) => {
        if (isQuestionLocked(questionId)) return;
        setAnswers(prev => {
            const next = (() => {
                const existing = prev.find(a => a.questionId === questionId);
                if (existing) {
                    return prev.map(a => a.questionId === questionId ? { ...a, answer } : a);
                }
                return [...prev, { questionId, answer }];
            })();
            if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
            saveDraftTimeoutRef.current = setTimeout(
                () => persistDraft(next, currentQuestionRef.current),
                1500
            );
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
                const preferEn = locale === "en";
                const rawTf = data.correctAnswerRaw ?? data.correctAnswer;
                const correctAnswer =
                    data.type === "TRUE_FALSE"
                        ? rawTf === "true"
                            ? tCommon("true")
                            : tCommon("false")
                        : preferEn && data.correctAnswerEn?.trim()
                            ? data.correctAnswerEn
                            : data.correctAnswer;
                const explanation =
                    preferEn && data.explanationEn?.trim()
                        ? data.explanationEn
                        : data.explanation ?? null;
                const nextFeedback: RevealedFeedback = {
                    ...revealedFeedbackRef.current,
                    [questionId]: {
                        correctAnswer,
                        explanation,
                    },
                };
                applyRevealedFeedback(nextFeedback);
                await persistDraft(
                    answersRef.current,
                    currentQuestionRef.current,
                    false,
                    nextFeedback
                );
            } else {
                toast.error(t("correctAnswerLoadFailed"));
            }
        } catch {
            toast.error(t("correctAnswerLoadFailed"));
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
                toast.info(t("nothingToTranslate"));
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
            toast.success(t("translatedToEnglish"));
        } catch {
            toast.error(t("translateFailed"));
        } finally {
            setTranslating(false);
        }
    };

    const handleMultipleChoiceToggle = (questionId: string, optionText: string) => {
        if (isQuestionLocked(questionId)) return;
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
            saveDraftTimeoutRef.current = setTimeout(
                () => persistDraft(next, currentQuestionRef.current),
                1500
            );
            return next;
        });
    };

    const handleDropdownSelect = (questionId: string, optionText: string) => {
        if (isQuestionLocked(questionId)) return;
        const nextAnswer = JSON.stringify(optionText ? [optionText] : []);
        setAnswers((prev) => {
            const existing = prev.find((a) => a.questionId === questionId);
            const next = existing
                ? prev.map((a) =>
                      a.questionId === questionId ? { ...a, answer: nextAnswer } : a
                  )
                : [...prev, { questionId, answer: nextAnswer }];
            if (saveDraftTimeoutRef.current) clearTimeout(saveDraftTimeoutRef.current);
            saveDraftTimeoutRef.current = setTimeout(
                () => persistDraft(next, currentQuestionRef.current),
                1500
            );
            return next;
        });
    };

    const getDropdownSelected = (questionId: string): string => {
        const raw = answers.find((a) => a.questionId === questionId)?.answer ?? "";
        if (!raw.trim()) return "";
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
        } catch {
            /* plain string */
        }
        return raw;
    };

    const handleMatchingChange = (questionId: string, map: Record<string, string>) => {
        if (isQuestionLocked(questionId)) return;
        handleAnswerChange(questionId, JSON.stringify(map));
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
                toast.success(t("submitSuccess"));
                router.push(`/courses/${courseId}/quizzes/${quizId}/result`);
            } else {
                const error = await response.text();
                toast.error(error || t("submitError"));
            }
        } catch (error) {
            console.error("Error submitting quiz:", error);
            toast.error(t("submitError"));
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
            } else if (navigation.nextContentType === 'certificate') {
                router.push(`/courses/${courseId}/certificate`);
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
            } else if (navigation.previousContentType === 'certificate') {
                router.push(`/courses/${courseId}/certificate`);
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
                    <p className="text-muted-foreground">{t("loadingResult")}</p>
                </div>
            </div>
        );
    }

    if (!quiz) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">{t("quizNotFound")}</h1>
                    <Button onClick={() => router.back()}>{t("goBack")}</Button>
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
                                {tCommon("back")}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={savingDraft}
                                onClick={() => persistDraft(answers, currentQuestion, true)}
                                className="flex items-center gap-2"
                            >
                                <Save className="h-4 w-4" />
                                {savingDraft ? t("saving") : t("saveAnswers")}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={translating || !quiz}
                                onClick={translatedQuiz ? () => setTranslatedQuiz(null) : handleTranslateQuiz}
                                className="flex items-center gap-2"
                            >
                                <Languages className="h-4 w-4" />
                                {translatedQuiz ? t("showArabic") : translating ? t("translating") : t("translateToEnglish")}
                            </Button>
                            {lastSavedAt && !savingDraft && (
                                <span className="text-xs text-muted-foreground">
                                    {t("lastSaved", { time: lastSavedAt.toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US") })}
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
                                {t("questionOf", { current: currentQuestion + 1, total: quiz.questions.length })}
                            </Badge>
                            {quiz.maxAttempts > 1 && (
                                <Badge variant="outline">
                                    {t("attemptOf", { current: quiz.currentAttempt || 1, max: quiz.maxAttempts })}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Quiz Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="auto-dir">{localizedField(quiz as unknown as Record<string, unknown>, "title", locale)}</CardTitle>
                            <CardDescription className="auto-dir">{localizedField(quiz as unknown as Record<string, unknown>, "description", locale)}</CardDescription>
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
                                {t("questionN", { n: currentQuestion + 1 })}
                                <Badge variant="outline">{t("pointsBadge", { points: currentQuestionData.points })}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {revealedCorrect[currentQuestionData.id] != null && (
                                <div className="rounded-md bg-muted/80 px-3 py-1.5 text-sm text-muted-foreground inline-flex items-center gap-1">
                                    {t("lockedAnswer")}
                                </div>
                            )}
                            <div className="text-lg auto-dir">
                                {(() => {
                                    const stored = resolveQuestionText(currentQuestionData, locale);
                                    if (locale === "en" && currentQuestionData.textEn?.trim()) return stored;
                                    return translatedQuiz?.questions[currentQuestion]?.text ?? stored;
                                })()}
                            </div>

                            {/* Question Image */}
                            {currentQuestionData.imageUrl && (
                                <div className="flex justify-center">
                                    <img 
                                        src={currentQuestionData.imageUrl} 
                                        alt={t("questionImageAlt")} 
                                        className="max-w-full h-auto max-h-96 rounded-lg border shadow-sm"
                                    />
                                </div>
                            )}

                            {currentQuestionData.type === "MULTIPLE_CHOICE" && (
                                <div className={`space-y-3 ${revealedCorrect[currentQuestionData.id] != null ? "pointer-events-none opacity-80" : ""}`}>
                                    {(() => {
                                        const hasStoredEn =
                                            locale === "en" &&
                                            (Array.isArray(currentQuestionData.optionsEn)
                                                ? currentQuestionData.optionsEn.some((o) => typeof o === "string" && o?.trim())
                                                : !!parseQuizOptions(typeof currentQuestionData.optionsEn === "string" ? currentQuestionData.optionsEn : null).length);
                                        const opts = hasStoredEn
                                            ? resolveQuestionOptions(currentQuestionData, locale)
                                            : (translatedQuiz?.questions[currentQuestion]?.options ??
                                                resolveQuestionOptions(currentQuestionData, locale));
                                        const origOpts = Array.isArray(currentQuestionData.options)
                                            ? currentQuestionData.options
                                            : parseQuizOptions(typeof currentQuestionData.options === "string" ? currentQuestionData.options : null);
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
                                                    <Label htmlFor={`option-${currentQuestionData.id}-${index}`} className="cursor-pointer flex-1 auto-dir">{option}</Label>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            )}

                            {currentQuestionData.type === "DROPDOWN" && (() => {
                                const hasStoredEn =
                                    locale === "en" &&
                                    (Array.isArray(currentQuestionData.optionsEn)
                                        ? currentQuestionData.optionsEn.some((o) => typeof o === "string" && o?.trim())
                                        : !!parseQuizOptions(typeof currentQuestionData.optionsEn === "string" ? currentQuestionData.optionsEn : null).length);
                                const opts = hasStoredEn
                                    ? resolveQuestionOptions(currentQuestionData, locale)
                                    : (translatedQuiz?.questions[currentQuestion]?.options ??
                                        resolveQuestionOptions(currentQuestionData, locale));
                                const origOpts = Array.isArray(currentQuestionData.options)
                                    ? currentQuestionData.options
                                    : parseQuizOptions(typeof currentQuestionData.options === "string" ? currentQuestionData.options : null);
                                const isLocked = revealedCorrect[currentQuestionData.id] != null;
                                const selectedOrig = getDropdownSelected(currentQuestionData.id);
                                return (
                                    <div className={isLocked ? "pointer-events-none opacity-80" : ""}>
                                        <Select
                                            value={selectedOrig || undefined}
                                            onValueChange={(value) =>
                                                handleDropdownSelect(currentQuestionData.id, value)
                                            }
                                            disabled={isLocked}
                                        >
                                            <SelectTrigger
                                                className="h-12 w-full rounded-xl border-border bg-background text-base auto-dir"
                                                dir={locale === "ar" ? "rtl" : "ltr"}
                                            >
                                                <SelectValue placeholder={t("choosePlaceholder")} />
                                            </SelectTrigger>
                                            <SelectContent dir={locale === "ar" ? "rtl" : "ltr"}>
                                                {opts.map((option: string, index: number) => {
                                                    const origOption = origOpts[index] ?? option;
                                                    return (
                                                        <SelectItem
                                                            key={`${currentQuestionData.id}-dd-${index}`}
                                                            value={origOption}
                                                            className="auto-dir text-base py-2.5"
                                                        >
                                                            {option}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                );
                            })()}

                            {currentQuestionData.type === "MATCHING" && (() => {
                                const matching = parseMatchingOptions(
                                    currentQuestionData.options as MatchingOptions | string | null
                                );
                                const matchingEn = parseMatchingOptions(
                                    currentQuestionData.optionsEn as MatchingOptions | string | null
                                );
                                const display = getMatchingDisplay(matching, matchingEn, locale);
                                const isLocked = revealedCorrect[currentQuestionData.id] != null;
                                const map = parseMatchingCorrect(
                                    answers.find((a) => a.questionId === currentQuestionData.id)?.answer
                                );
                                return (
                                    <div className={isLocked ? "pointer-events-none opacity-80" : ""}>
                                        <MatchingQuestion
                                            prompts={display.prompts}
                                            answers={display.answers}
                                            promptsDisplay={display.promptsDisplay}
                                            answersDisplay={display.answersDisplay}
                                            value={map}
                                            onChange={(next) =>
                                                handleMatchingChange(currentQuestionData.id, next)
                                            }
                                            disabled={isLocked}
                                        />
                                    </div>
                                );
                            })()}

                            {currentQuestionData.type === "TRUE_FALSE" && (
                                <div className={revealedCorrect[currentQuestionData.id] != null ? "pointer-events-none opacity-80" : ""}>
                                    <RadioGroup
                                        value={answers.find(a => a.questionId === currentQuestionData.id)?.answer || ""}
                                        onValueChange={(value) => handleAnswerChange(currentQuestionData.id, value)}
                                        disabled={revealedCorrect[currentQuestionData.id] != null}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem
                                                value="true"
                                                id={`true-${currentQuestionData.id}`}
                                                disabled={revealedCorrect[currentQuestionData.id] != null}
                                            />
                                            <Label htmlFor={`true-${currentQuestionData.id}`}>{tCommon("true")}</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem
                                                value="false"
                                                id={`false-${currentQuestionData.id}`}
                                                disabled={revealedCorrect[currentQuestionData.id] != null}
                                            />
                                            <Label htmlFor={`false-${currentQuestionData.id}`}>{tCommon("false")}</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                            )}

                            {currentQuestionData.type === "SHORT_ANSWER" && (
                                <Textarea
                                    placeholder={t("writeAnswer")}
                                    value={answers.find(a => a.questionId === currentQuestionData.id)?.answer || ""}
                                    onChange={(e) => handleAnswerChange(currentQuestionData.id, e.target.value)}
                                    rows={4}
                                    disabled={revealedCorrect[currentQuestionData.id] != null}
                                    className={revealedCorrect[currentQuestionData.id] != null ? "opacity-80" : ""}
                                />
                            )}

                            {hasAnsweredQuestion(answers, currentQuestionData.id, currentQuestionData.type) && (
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
                                            {loadingCorrectId === currentQuestionData.id
                                                ? tCommon("loading")
                                                : t("showCorrectAnswer")}
                                        </Button>
                                    ) : (
                                        <div className="rounded-md bg-muted p-3 text-sm space-y-2">
                                            <div>
                                                <span className="font-medium text-muted-foreground">
                                                    {t("correctAnswerLabel")}
                                                </span>
                                                <span>
                                                    {translatedQuiz &&
                                                    revealedCorrectTranslated[currentQuestionData.id] != null
                                                        ? revealedCorrectTranslated[currentQuestionData.id]
                                                        : revealedCorrect[currentQuestionData.id]}
                                                </span>
                                            </div>
                                            {(revealedExplanation[currentQuestionData.id] ||
                                                revealedExplanationTranslated[currentQuestionData.id]) && (
                                                <div className="pt-2 border-t border-muted-foreground/20">
                                                    <span className="font-medium text-muted-foreground block mb-1">
                                                        {t("explanationLabel")}
                                                    </span>
                                                    <span>
                                                        {translatedQuiz &&
                                                        revealedExplanationTranslated[currentQuestionData.id] != null
                                                            ? revealedExplanationTranslated[currentQuestionData.id]
                                                            : revealedExplanation[currentQuestionData.id]}
                                                    </span>
                                                </div>
                                            )}
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
                            onClick={() => goToQuestion(Math.max(0, currentQuestion - 1))}
                            disabled={currentQuestion === 0}
                        >
                            {tCommon("previous")}
                        </Button>

                        <div className="flex items-center gap-2">
                            {currentQuestion === quiz.questions.length - 1 ? (
                                <Button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="bg-primary hover:bg-primary/90"
                                >
                                    {submitting ? t("submitting") : t("finishQuiz")}
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => goToQuestion(currentQuestion + 1)}
                                    className="bg-primary hover:bg-primary/90"
                                >
                                    {tCommon("next")}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Warning */}
                    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                                <AlertCircle className="h-5 w-5" />
                                <span className="font-medium">{t("notice")}</span>
                            </div>
                            <p className="text-amber-700 dark:text-amber-200 mt-2">
                                {quiz.maxAttempts > 1
                                    ? t("finishHintWithRetries", { count: quiz.maxAttempts - (quiz.currentAttempt || 1) })
                                    : t("finishHint")
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
                            {tCourse("previousContent")}
                        </Button>

                        <Button
                            onClick={onNext}
                            disabled={!navigation?.nextContentId}
                            className="flex items-center gap-2"
                        >
                            {tCourse("nextContent")}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
} 