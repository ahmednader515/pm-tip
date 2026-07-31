"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical, X, Mic, FileSpreadsheet, Languages } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useRouter, useParams, usePathname } from "next/navigation";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { UploadDropzone } from "@/lib/uploadthing";
import { parseCorrectAnswer } from "@/lib/utils";
import { useTranslations } from "next-intl";
import * as XLSX from "xlsx";
// Needed for correct non-English decoding in legacy .xls files (BIFF)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as cptable from "xlsx/dist/cpexcel.full.mjs";

// Wire the codepage tables once
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof (XLSX as any).set_cptable === "function") (XLSX as any).set_cptable(cptable);

interface Course {
    id: string;
    title: string;
    isPublished: boolean;
}

interface Chapter {
    id: string;
    title: string;
    position: number;
    isPublished: boolean;
}

interface Quiz {
    id: string;
    title: string;
    titleEn?: string | null;
    description: string;
    descriptionEn?: string | null;
    courseId: string;
    position: number;
    isPublished: boolean;
    course: {
        title: string;
    };
    questions: Question[];
    createdAt: string;
    updatedAt: string;
    timer?: number;
    maxAttempts?: number;
}

interface Question {
    id: string;
    text: string;
    textEn?: string;
    imageUrl?: string;
    type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
    options?: string[];
    optionsEn?: string[];
    correctAnswer: string | number | number[]; // TRUE_FALSE/SHORT_ANSWER: string; MULTIPLE_CHOICE: number[] (indices)
    explanation?: string;
    explanationEn?: string;
    points: number;
}

interface CourseItem {
    id: string;
    title: string;
    type: "chapter" | "quiz";
    position: number;
    isPublished: boolean;
}

const EditQuizPage = () => {
    const router = useRouter();
    const params = useParams();
    const quizId = params.quizId as string;
    const pathname = usePathname();
    const tCommon = useTranslations("common");
    const tEditor = useTranslations("editor");
    const t = useTranslations("dashboard.teacher.quizEditor");
    const dashboardPath = pathname.includes("/dashboard/admin/")
        ? "/dashboard/admin/quizzes"
        : "/dashboard/teacher/quizzes";
    
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<string>("");
    const [quizTitle, setQuizTitle] = useState("");
    const [quizTitleEn, setQuizTitleEn] = useState("");
    const [quizDescription, setQuizDescription] = useState("");
    const [quizDescriptionEn, setQuizDescriptionEn] = useState("");
    const [quizTimer, setQuizTimer] = useState<number | null>(null);
    const [quizMaxAttempts, setQuizMaxAttempts] = useState<number>(1);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [selectedPosition, setSelectedPosition] = useState<number>(1);
    const [courseItems, setCourseItems] = useState<CourseItem[]>([]);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [isLoadingCourseItems, setIsLoadingCourseItems] = useState(false);
    const [isUpdatingQuiz, setIsUpdatingQuiz] = useState(false);
    const [isLoadingQuiz, setIsLoadingQuiz] = useState(true);
    const [uploadingImages, setUploadingImages] = useState<{ [key: string]: boolean }>({});
    const [listeningQuestionId, setListeningQuestionId] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const [importingExcel, setImportingExcel] = useState(false);
    const [suggestingEnglish, setSuggestingEnglish] = useState(false);

    const normalizeType = (raw: unknown): Question["type"] => {
        const v = String(raw ?? "").trim().toUpperCase();
        if (v === "MCQ" || v === "MULTIPLE_CHOICE" || v === "MULTIPLE" || v === "CHOICE" || v === "اختيار" || v === "اختيار من متعدد") return "MULTIPLE_CHOICE";
        if (v === "TF" || v === "TRUE_FALSE" || v === "TRUE/FALSE" || v === "صح/خطأ" || v === "صح" || v === "خطأ") return "TRUE_FALSE";
        if (v === "SHORT" || v === "SHORT_ANSWER" || v === "SA" || v === "إجابة قصيرة") return "SHORT_ANSWER";
        return "MULTIPLE_CHOICE";
    };

    const splitOptions = (raw: unknown): string[] => {
        if (raw == null) return [];
        if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
        const s = String(raw).trim();
        if (!s) return [];
        return s
            .split(/[\|\;\n,]+/g)
            .map((x) => x.trim())
            .filter(Boolean);
    };

    const parseCorrectIndices = (raw: unknown, options: string[]): number[] => {
        const s = String(raw ?? "").trim();
        if (!s) return [0];
        const parts = s.split(/[\|\;\n,]+/g).map((x) => x.trim()).filter(Boolean);
        const indices: number[] = [];
        for (const p of parts) {
            const asNum = Number(p);
            if (!Number.isNaN(asNum) && Number.isFinite(asNum)) {
                const idx = Math.round(asNum) - 1;
                if (idx >= 0 && idx < options.length) indices.push(idx);
                continue;
            }
            const idx = options.findIndex((o) => o.trim() === p);
            if (idx >= 0) indices.push(idx);
        }
        const unique = Array.from(new Set(indices)).sort((a, b) => a - b);
        return unique.length ? unique : [0];
    };

    const parseTrueFalse = (raw: unknown): "true" | "false" => {
        const s = String(raw ?? "").trim().toLowerCase();
        if (s === "true" || s === "1" || s === "صح" || s === "صحيح" || s === "yes" || s === "y") return "true";
        return "false";
    };

    const importQuestionsFromExcel = async (file: File) => {
        setImportingExcel(true);
        try {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext !== "xlsx") {
                toast.error(t("xlsxOnlyError"));
                return;
            }
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const sheetName = wb.SheetNames[0];
            const sheet = wb.Sheets[sheetName];
            if (!sheet) throw new Error("No sheet");

            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
            if (!rows.length) {
                toast.error(t("excelEmpty"));
                return;
            }

            const normalizeKey = (k: string) => k.trim().toLowerCase();
            const get = (row: Record<string, unknown>, key: string) => {
                const want = normalizeKey(key);
                const found = Object.keys(row).find((rk) => normalizeKey(rk) === want);
                return found ? row[found] : "";
            };

            const imported: Question[] = [];
            const errors: string[] = [];

            rows.forEach((row, idx) => {
                const rowNum = idx + 2;
                const text = String(get(row, "text") ?? "").trim();
                if (!text) {
                    errors.push(t("rowTextRequired", { row: rowNum }));
                    return;
                }

                const type = normalizeType(get(row, "type"));
                const pointsRaw = get(row, "points");
                const points = Math.max(1, Number(pointsRaw) ? Math.floor(Number(pointsRaw)) : 1);
                const explanation = String(get(row, "explanation") ?? "").trim();

                if (type === "MULTIPLE_CHOICE") {
                    const options = splitOptions(get(row, "options"));
                    if (options.length < 2) {
                        errors.push(t("rowOptionsMin", { row: rowNum }));
                        return;
                    }
                    const correct = parseCorrectIndices(get(row, "correct"), options);
                    imported.push({
                        id: `import-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
                        text,
                        type,
                        options,
                        correctAnswer: correct,
                        explanation,
                        points,
                    });
                } else if (type === "TRUE_FALSE") {
                    const correct = parseTrueFalse(get(row, "correct"));
                    imported.push({
                        id: `import-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
                        text,
                        type,
                        correctAnswer: correct,
                        explanation,
                        points,
                    });
                } else {
                    const correct = String(get(row, "correct") ?? "").trim();
                    if (!correct) {
                        errors.push(t("rowCorrectRequired", { row: rowNum }));
                        return;
                    }
                    imported.push({
                        id: `import-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
                        text,
                        type,
                        correctAnswer: correct,
                        explanation,
                        points,
                    });
                }
            });

            if (errors.length) {
                toast.error(errors.slice(0, 6).join("\n") + (errors.length > 6 ? `\n${t("moreErrors", { count: errors.length - 6 })}` : ""));
            }

            if (imported.length) {
                setQuestions((prev) => [...prev, ...imported]);
                toast.success(t("importSuccess", { count: imported.length }));
            } else if (!errors.length) {
                toast.error(t("importNone"));
            }
        } catch (e) {
            console.error("[IMPORT_EXCEL]", e);
            toast.error(t("importFailed"));
        } finally {
            setImportingExcel(false);
        }
    };

    useEffect(() => {
        fetchCourses();
        fetchQuiz();
    }, [quizId]);

    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const fetchCourses = async () => {
        try {
            const response = await fetch("/api/courses");
            if (response.ok) {
                const data = await response.json();
                const teacherCourses = data.filter((course: Course) => course.isPublished);
                setCourses(teacherCourses);
            }
        } catch (error) {
            console.error("Error fetching courses:", error);
        }
    };

    const fetchQuiz = async () => {
        try {
            const response = await fetch(`/api/teacher/quizzes/${quizId}`);
            if (response.ok) {
                const quiz: Quiz = await response.json();
                setQuizTitle(quiz.title);
                setQuizTitleEn(quiz.titleEn ?? "");
                setQuizDescription(quiz.description);
                setQuizDescriptionEn(quiz.descriptionEn ?? "");
                setQuizTimer(quiz.timer || null);
                setQuizMaxAttempts(quiz.maxAttempts || 1);
                setSelectedCourse(quiz.courseId);
                
                // Convert stored correctAnswer (string or JSON array of option texts) to indices for multiple choice
                const processedQuestions = quiz.questions.map((question: Question) => {
                    if (question.type === "MULTIPLE_CHOICE" && question.options) {
                        const validOptions = question.options.filter((o: string) => o.trim() !== "");
                        const correctTexts = parseCorrectAnswer(String(question.correctAnswer));
                        const indices = correctTexts
                            .map((t) => validOptions.indexOf(t))
                            .filter((i) => i >= 0);
                        return {
                            ...question,
                            textEn: question.textEn ?? "",
                            explanationEn: question.explanationEn ?? "",
                            optionsEn: question.optionsEn?.length
                                ? question.optionsEn
                                : question.options.map(() => ""),
                            correctAnswer: indices.length ? indices : [0]
                        };
                    }
                    return {
                        ...question,
                        textEn: question.textEn ?? "",
                        explanationEn: question.explanationEn ?? "",
                    };
                });
                
                setQuestions(processedQuestions);
                setSelectedPosition(quiz.position);
                await fetchCourseItems(quiz.courseId);
            } else {
                toast.error(t("loadQuizError"));
                router.push(dashboardPath);
            }
        } catch (error) {
            console.error("Error fetching quiz:", error);
            toast.error(t("loadQuizError"));
            router.push(dashboardPath);
        } finally {
            setIsLoadingQuiz(false);
        }
    };

    const fetchCourseItems = async (courseId: string) => {
        try {
            setIsLoadingCourseItems(true);
            // Clear existing items first
            setCourseItems([]);
            
            const [chaptersResponse, quizzesResponse] = await Promise.all([
                fetch(`/api/courses/${courseId}/chapters`),
                fetch(`/api/courses/${courseId}/quizzes`)
            ]);
            
            const chaptersData = chaptersResponse.ok ? await chaptersResponse.json() : [];
            const quizzesData = quizzesResponse.ok ? await quizzesResponse.json() : [];
            
            // Combine chapters and existing quizzes for display
            const items: CourseItem[] = [
                ...chaptersData.map((chapter: Chapter) => ({
                    id: chapter.id,
                    title: chapter.title,
                    type: "chapter" as const,
                    position: chapter.position,
                    isPublished: chapter.isPublished
                })),
                ...quizzesData.map((quiz: Quiz) => ({
                    id: quiz.id,
                    title: quiz.title,
                    type: "quiz" as const,
                    position: quiz.position,
                    isPublished: quiz.isPublished
                }))
            ];
            
            // Sort by position
            items.sort((a, b) => a.position - b.position);
            
            setCourseItems(items);
            setChapters(chaptersData);
            
            // Update the selected position to reflect the actual position of the quiz in the list
            const quizInList = items.find(item => item.id === quizId);
            if (quizInList) {
                setSelectedPosition(quizInList.position);
            }
        } catch (error) {
            console.error("Error fetching course items:", error);
            // Clear items on error
            setCourseItems([]);
        } finally {
            setIsLoadingCourseItems(false);
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (error) {
                console.error("[SPEECH_RECOGNITION_STOP]", error);
            }
            recognitionRef.current = null;
        }
        setListeningQuestionId(null);
    };

    const handleSpeechInput = (index: number) => {
        if (typeof window === "undefined") {
            return;
        }

        const question = questions[index];
        if (!question) {
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            toast.error(t("speechUnsupported"));
            return;
        }

        if (listeningQuestionId === question.id) {
            stopListening();
            return;
        }

        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = "ar-SA";
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                setListeningQuestionId(question.id);
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results?.[0]?.[0]?.transcript;
                if (transcript) {
                    setQuestions((prev) => {
                        const updated = [...prev];
                        const current = updated[index];
                        if (!current) {
                            return prev;
                        }
                        const newText = current.text ? `${current.text} ${transcript}` : transcript;
                        updated[index] = { ...current, text: newText };
                        return updated;
                    });
                }
            };

            recognition.onerror = (event: any) => {
                console.error("[SPEECH_RECOGNITION_ERROR]", event.error);
                toast.error(t("speechRecognizeFailed"));
            };

            recognition.onend = () => {
                setListeningQuestionId(null);
                recognitionRef.current = null;
            };

            recognitionRef.current = recognition;
            recognition.start();
        } catch (error) {
            console.error("[SPEECH_RECOGNITION]", error);
            toast.error(t("speechStartFailed"));
            stopListening();
        }
    };

    const handleUpdateQuiz = async () => {
        stopListening();
        if (!selectedCourse || !quizTitle.trim()) {
            toast.error(t("fillRequired"));
            return;
        }

        // Validate questions
        const validationErrors: string[] = [];

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            // Validate question text
            if (!question.text || question.text.trim() === "") {
                validationErrors.push(t("validationTextRequired", { n: i + 1 }));
                continue;
            }

            // Validate correct answer
            if (question.type === "MULTIPLE_CHOICE") {
                const validOptions = question.options?.filter(option => option.trim() !== "") || [];
                if (validOptions.length === 0) {
                    validationErrors.push(t("validationOptionsMin", { n: i + 1 }));
                    continue;
                }
                const correctArr = Array.isArray(question.correctAnswer)
                    ? question.correctAnswer
                    : typeof question.correctAnswer === "number"
                    ? [question.correctAnswer]
                    : [];
                if (correctArr.length === 0 || correctArr.some((idx) => idx < 0 || idx >= validOptions.length)) {
                    validationErrors.push(t("validationCorrectMcq", { n: i + 1 }));
                    continue;
                }
            } else if (question.type === "TRUE_FALSE") {
                if (!question.correctAnswer || (question.correctAnswer !== "true" && question.correctAnswer !== "false")) {
                    validationErrors.push(t("validationCorrectTf", { n: i + 1 }));
                    continue;
                }
            } else if (question.type === "SHORT_ANSWER") {
                if (!question.correctAnswer || question.correctAnswer.toString().trim() === "") {
                    validationErrors.push(t("validationCorrectSa", { n: i + 1 }));
                    continue;
                }
            }

            // Check if points are valid
            if (question.points <= 0) {
                validationErrors.push(t("validationPoints", { n: i + 1 }));
                continue;
            }
        }

        if (validationErrors.length > 0) {
            toast.error(validationErrors.join('\n'));
            return;
        }

        // Additional validation: ensure no questions are empty
        if (questions.length === 0) {
            toast.error(t("atLeastOneQuestion"));
            return;
        }

        // Clean up questions before sending
        const cleanedQuestions = questions.map(question => {
            if (question.type === "MULTIPLE_CHOICE" && question.options) {
                const optsEn = question.optionsEn || [];
                const paired = question.options
                    .map((option, i) => ({ option, en: optsEn[i] ?? "" }))
                    .filter(({ option }) => option.trim() !== "");
                return {
                    ...question,
                    options: paired.map((p) => p.option),
                    optionsEn: paired.map((p) => p.en),
                };
            }
            return question;
        });

        setIsUpdatingQuiz(true);
        try {
            const response = await fetch(`/api/teacher/quizzes/${quizId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: quizTitle,
                    titleEn: quizTitleEn.trim() || null,
                    description: quizDescription,
                    descriptionEn: quizDescriptionEn.trim() || null,
                    courseId: selectedCourse,
                    questions: cleanedQuestions,
                    position: selectedPosition,
                    timer: quizTimer,
                    maxAttempts: quizMaxAttempts,
                }),
            });

            if (response.ok) {
                toast.success(t("updateSuccess"));
                router.push(dashboardPath);
            } else {
                const error = await response.json();
                toast.error(error.message || t("updateError"));
            }
        } catch (error) {
            console.error("Error updating quiz:", error);
            toast.error(t("updateError"));
        } finally {
            setIsUpdatingQuiz(false);
        }
    };

    const addQuestion = () => {
        const newQuestion: Question = {
            id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text: "",
            textEn: "",
            type: "MULTIPLE_CHOICE",
            options: ["", ""],
            optionsEn: ["", ""],
            correctAnswer: [0],
            explanation: "",
            explanationEn: "",
            points: 1,
        };
        setQuestions([...questions, newQuestion]);
    };

    const suggestEnglish = async () => {
        const texts: string[] = [quizTitle, quizDescription];
        const meta: { kind: string; qi?: number; oi?: number }[] = [
            { kind: "title" },
            { kind: "description" },
        ];
        questions.forEach((q, qi) => {
            texts.push(q.text || "");
            meta.push({ kind: "text", qi });
            texts.push(q.explanation || "");
            meta.push({ kind: "explanation", qi });
            if (q.type === "MULTIPLE_CHOICE") {
                (q.options || []).forEach((opt, oi) => {
                    texts.push(opt || "");
                    meta.push({ kind: "option", qi, oi });
                });
            }
        });
        if (!texts.some((t) => t.trim())) {
            toast.error(t("noArabicToTranslate"));
            return;
        }
        setSuggestingEnglish(true);
        try {
            const res = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texts }),
            });
            if (!res.ok) throw new Error("translate failed");
            const data = await res.json();
            const translations: string[] = data.translations || [];
            const nextQuestions = questions.map((q) => ({
                ...q,
                optionsEn: q.optionsEn ? [...q.optionsEn] : (q.options || []).map(() => ""),
            }));
            translations.forEach((tr, i) => {
                const m = meta[i];
                if (!m) return;
                if (m.kind === "title") setQuizTitleEn(tr);
                else if (m.kind === "description") setQuizDescriptionEn(tr);
                else if (m.kind === "text" && m.qi != null) nextQuestions[m.qi].textEn = tr;
                else if (m.kind === "explanation" && m.qi != null) nextQuestions[m.qi].explanationEn = tr;
                else if (m.kind === "option" && m.qi != null && m.oi != null) {
                    const opts = nextQuestions[m.qi].optionsEn || [];
                    while (opts.length <= m.oi) opts.push("");
                    opts[m.oi] = tr;
                    nextQuestions[m.qi].optionsEn = opts;
                }
            });
            setQuestions(nextQuestions);
            toast.success(t("suggestSuccess"));
        } catch {
            toast.error(t("suggestFailed"));
        } finally {
            setSuggestingEnglish(false);
        }
    };

    const addOption = (questionIndex: number) => {
        const question = questions[questionIndex];
        const currentOptions = question.options || ["", ""];
        const currentOptionsEn = question.optionsEn || currentOptions.map(() => "");
        const updated = {
            ...question,
            options: [...currentOptions, ""],
            optionsEn: [...currentOptionsEn, ""],
        };
        const updatedQuestions = [...questions];
        updatedQuestions[questionIndex] = updated;
        setQuestions(updatedQuestions);
    };

    const removeOption = (questionIndex: number, optionIndex: number) => {
        const question = questions[questionIndex];
        const currentOptions = question.options || ["", ""];
        if (currentOptions.length <= 2) return;
        const newOptions = currentOptions.filter((_, i) => i !== optionIndex);
        const newOptionsEn = (question.optionsEn || []).filter((_, i) => i !== optionIndex);
        const currentCorrect = Array.isArray(question.correctAnswer)
            ? question.correctAnswer
            : typeof question.correctAnswer === "number"
            ? [question.correctAnswer]
            : [0];
        const newCorrect = currentCorrect
            .filter((i) => i !== optionIndex)
            .map((i) => (i > optionIndex ? i - 1 : i));
        const updated = {
            ...question,
            options: newOptions,
            optionsEn: newOptionsEn,
            correctAnswer: newCorrect.length ? newCorrect : [0],
        };
        const updatedQuestions = [...questions];
        updatedQuestions[questionIndex] = updated;
        setQuestions(updatedQuestions);
    };

    const toggleCorrectOption = (questionIndex: number, optionIndex: number) => {
        const question = questions[questionIndex];
        const current = Array.isArray(question.correctAnswer)
            ? question.correctAnswer
            : typeof question.correctAnswer === "number"
            ? [question.correctAnswer]
            : [0];
        const set = new Set(current);
        if (set.has(optionIndex)) set.delete(optionIndex);
        else set.add(optionIndex);
        const newCorrect = Array.from(set).sort((a, b) => a - b);
        if (newCorrect.length === 0) return;
        updateQuestion(questionIndex, "correctAnswer", newCorrect);
    };

    const updateQuestion = (index: number, field: keyof Question, value: any) => {
        const updatedQuestions = [...questions];
        updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
        setQuestions(updatedQuestions);
    };

    const removeQuestion = (index: number) => {
        if (questions[index]?.id === listeningQuestionId) {
            stopListening();
        }
        const updatedQuestions = questions.filter((_, i) => i !== index);
        setQuestions(updatedQuestions);
    };

    const handleDragEnd = async (result: any) => {
        if (!result.destination) return;

        // Handle dragging the quiz being edited
        if (result.draggableId === quizId) {
            // Calculate the position for the quiz based on where it was dropped
            const newQuizPosition = result.destination.index + 1;
            setSelectedPosition(newQuizPosition);
            
            // Reorder the items array to reflect the new position
            const reorderedItems = Array.from(courseItems);
            const [movedItem] = reorderedItems.splice(result.source.index, 1);
            reorderedItems.splice(result.destination.index, 0, movedItem);
            
            setCourseItems(reorderedItems);

            // Create update data for all items with type information
            const updateData = reorderedItems.map((item, index) => ({
                id: item.id,
                type: item.type,
                position: index + 1,
            }));

            // Call the mixed reorder API
            try {
                const response = await fetch(`/api/courses/${selectedCourse}/reorder`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        list: updateData
                    }),
                });

                if (response.ok) {
                    toast.success(t("reorderSuccess"));
                } else {
                    toast.error(t("reorderError"));
                }
            } catch (error) {
                console.error("Error reordering quiz:", error);
                toast.error(t("reorderError"));
            }
        }
        // For other items, we don't want to reorder them, so we ignore the drag
        // The drag and drop library will handle the visual feedback, but we don't update state
    };

    if (isLoadingQuiz) {
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
                    {t("editTitle")}
                </h1>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={suggestEnglish}
                        disabled={suggestingEnglish}
                        className="gap-2"
                    >
                        <Languages className="h-4 w-4" />
                        {suggestingEnglish ? "..." : tCommon("suggestEnglish")}
                    </Button>
                    <Button variant="outline" onClick={() => router.push(dashboardPath)}>
                        {t("backToQuizzes")}
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>{t("selectCourse")}</Label>
                        <Select value={selectedCourse} onValueChange={(value) => {
                            setSelectedCourse(value);
                            // Clear previous data immediately
                            setCourseItems([]);
                            // Don't reset position when changing course - keep the quiz's current position
                            if (value) {
                                fetchCourseItems(value);
                            }
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder={t("selectCoursePlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                                {courses.map((course) => (
                                    <SelectItem key={course.id} value={course.id}>
                                        {course.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>{tCommon("arabicLabel")} — {t("quizTitleLabel")}</Label>
                        <Input
                            value={quizTitle}
                            onChange={(e) => setQuizTitle(e.target.value)}
                            placeholder={t("quizTitlePlaceholder")}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>{tCommon("englishLabel")} — {tEditor("titleEn")}</Label>
                    <Input
                        dir="ltr"
                        value={quizTitleEn}
                        onChange={(e) => setQuizTitleEn(e.target.value)}
                        placeholder={t("quizTitlePlaceholderEn")}
                    />
                </div>

                {selectedCourse && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("reorderTitle")}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                {t("reorderHintEdit")}
                            </p>
                            <p className="text-sm text-blue-600">
                                {t("selectedPosition", { position: selectedPosition })}
                            </p>
                        </CardHeader>
                        <CardContent>
                            {isLoadingCourseItems ? (
                                <div className="text-center py-8">
                                    <div className="text-muted-foreground">{t("loadingCourseContent")}</div>
                                </div>
                            ) : courseItems.length > 0 ? (
                                <DragDropContext onDragEnd={handleDragEnd}>
                                    <Droppable droppableId="course-items">
                                        {(provided) => (
                                            <div
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className="space-y-2"
                                            >
                                                {courseItems.map((item, index) => (
                                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`p-3 border rounded-lg flex items-center justify-between ${
                                                                    snapshot.isDragging ? "bg-blue-50" : "bg-white"
                                                                } ${item.id === quizId ? "border-2 border-dashed border-blue-300 bg-blue-50" : ""}`}
                                                            >
                                                                <div className="flex items-center space-x-3">
                                                                    <div {...provided.dragHandleProps} className={item.id === quizId ? "cursor-grab active:cursor-grabbing" : ""}>
                                                                        <GripVertical className={`h-4 w-4 ${item.id === quizId ? "text-blue-600" : "text-gray-300 cursor-not-allowed"}`} />
                                                                    </div>
                                                                    <div>
                                                                        <div className={`font-medium ${item.id === quizId ? "text-blue-800" : ""}`}>
                                                                            {item.title}
                                                                        </div>
                                                                        <div className={`text-sm ${item.id === quizId ? "text-blue-600" : "text-muted-foreground"}`}>
                                                                            {item.type === "chapter" ? t("chapterType") : t("quizType")}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <Badge variant={item.id === quizId ? "outline" : (item.isPublished ? "default" : "secondary")} className={item.id === quizId ? "border-blue-300 text-blue-700" : ""}>
                                                                    {item.id === quizId ? t("editingBadge") : (item.isPublished ? tCommon("published") : tCommon("draft"))}
                                                                </Badge>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground mb-4">
                                        {t("emptyCourseContent")}
                                    </p>
                                    <div className="p-3 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
                                        <div className="flex items-center justify-center space-x-3">
                                            <div>
                                                <div className="font-medium text-blue-800">
                                                    {quizTitle || t("newQuizDefault")}
                                                </div>
                                                <div className="text-sm text-blue-600">{t("quizType")}</div>
                                            </div>
                                            <Badge variant="outline" className="border-blue-300 text-blue-700">{t("editingBadge")}</Badge>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-2">
                    <Label>{tCommon("arabicLabel")} — {t("quizDescriptionLabel")}</Label>
                    <Textarea
                        value={quizDescription}
                        onChange={(e) => setQuizDescription(e.target.value)}
                        placeholder={t("quizDescriptionPlaceholder")}
                        rows={3}
                    />
                </div>

                <div className="space-y-2">
                    <Label>{tCommon("englishLabel")} — {tEditor("descriptionEn")}</Label>
                    <Textarea
                        dir="ltr"
                        value={quizDescriptionEn}
                        onChange={(e) => setQuizDescriptionEn(e.target.value)}
                        placeholder={t("quizDescriptionPlaceholderEn")}
                        rows={3}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>{t("timerLabel")}</Label>
                        <Input
                            type="number"
                            value={quizTimer || ""}
                            onChange={(e) => setQuizTimer(e.target.value ? parseInt(e.target.value) : null)}
                            placeholder={t("timerPlaceholder")}
                            min="1"
                        />
                        <p className="text-sm text-muted-foreground">
                            {t("timerHint")}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label>{t("maxAttemptsLabel")}</Label>
                        <Input
                            type="number"
                            value={quizMaxAttempts}
                            onChange={(e) => setQuizMaxAttempts(parseInt(e.target.value))}
                            min="1"
                            max="10"
                        />
                        <p className="text-sm text-muted-foreground">
                            {t("maxAttemptsHint")}
                        </p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5" />
                            {t("importExcelTitle")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <Input
                                type="file"
                                accept=".xlsx"
                                disabled={importingExcel}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    importQuestionsFromExcel(f);
                                    e.currentTarget.value = "";
                                }}
                            />
                        </div>

                        <div className="text-sm text-muted-foreground space-y-2">
                            <div className="font-medium text-foreground">{t("excelFormatTitle")}</div>
                            <ul className="list-disc pr-5 space-y-1">
                                <li><span className="font-medium">text</span>: {t("excelColText")}</li>
                                <li><span className="font-medium">type</span>: {t("excelColType")}</li>
                                <li><span className="font-medium">points</span>: {t("excelColPoints")}</li>
                                <li><span className="font-medium">options</span>: {t("excelColOptions")}</li>
                                <li><span className="font-medium">correct</span>:</li>
                                <ul className="list-disc pr-5">
                                    <li>{t("excelColCorrectMcq")}</li>
                                    <li>{t("excelColCorrectTf")}</li>
                                    <li>{t("excelColCorrectSa")}</li>
                                </ul>
                                <li><span className="font-medium">explanation</span>: {t("excelColExplanation")}</li>
                            </ul>
                            <div className="text-xs">
                                {t("excelNote")}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>{t("questionsLabel")}</Label>
                        <Button type="button" variant="outline" onClick={addQuestion}>
                            <Plus className="h-4 w-4 mr-2" />
                            {t("addQuestion")}
                        </Button>
                    </div>

                    {questions.map((question, index) => (
                        <Card key={question.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg">{t("questionN", { n: index + 1 })}</CardTitle>
                                        {(!question.text.trim() || 
                                            (question.type === "MULTIPLE_CHOICE" &&
                                             (!question.options || question.options.filter(opt => opt.trim() !== "").length === 0)) ||
                                            (question.type === "MULTIPLE_CHOICE" && (!Array.isArray(question.correctAnswer) || question.correctAnswer.length === 0)) ||
                                            (question.type === "TRUE_FALSE" &&
                                             (typeof question.correctAnswer !== 'string' || (question.correctAnswer !== "true" && question.correctAnswer !== "false"))) ||
                                            (question.type === "SHORT_ANSWER" &&
                                             (typeof question.correctAnswer !== 'string' || question.correctAnswer.trim() === ""))) && (
                                            <Badge variant="destructive" className="text-xs">
                                                {t("incomplete")}
                                            </Badge>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => removeQuestion(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>{t("questionTextLabel")}</Label>
                                        <div className="flex items-center gap-2">
                                            {listeningQuestionId === question.id && (
                                                <span className="text-xs text-blue-600">
                                                    {t("listening")}
                                                </span>
                                            )}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-pressed={listeningQuestionId === question.id}
                                                onClick={() => handleSpeechInput(index)}
                                                className={listeningQuestionId === question.id ? "text-red-500 animate-pulse" : ""}
                                            >
                                                <Mic className="h-4 w-4" />
                                                <span className="sr-only">
                                                    {listeningQuestionId === question.id ? t("stopSpeech") : t("startSpeech")}
                                                </span>
                                            </Button>
                                        </div>
                                    </div>
                                    <Textarea
                                        value={question.text}
                                        onChange={(e) => updateQuestion(index, "text", e.target.value)}
                                        placeholder={t("questionTextPlaceholder")}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>{tCommon("englishLabel")} — {tEditor("textEn")}</Label>
                                    <Textarea
                                        dir="ltr"
                                        value={question.textEn ?? ""}
                                        onChange={(e) => updateQuestion(index, "textEn", e.target.value)}
                                        placeholder={t("questionTextPlaceholderEn")}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>{t("questionImageLabel")}</Label>
                                    <div className="space-y-2">
                                        {question.imageUrl ? (
                                            <div className="relative">
                                                <img 
                                                    src={question.imageUrl} 
                                                    alt="Question" 
                                                    className="max-w-full h-auto max-h-48 rounded-lg border"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="sm"
                                                    className="absolute top-2 right-2"
                                                    onClick={() => updateQuestion(index, "imageUrl", "")}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                                                <UploadDropzone
                                                    endpoint="courseAttachment"
                                                    onClientUploadComplete={(res) => {
                                                        if (res && res[0]) {
                                                            updateQuestion(index, "imageUrl", res[0].url);
                                                            toast.success(t("imageUploadSuccess"));
                                                        }
                                                        setUploadingImages(prev => ({ ...prev, [index]: false }));
                                                    }}
                                                    onUploadError={(error: Error) => {
                                                        toast.error(t("imageUploadError", { message: error.message }));
                                                        setUploadingImages(prev => ({ ...prev, [index]: false }));
                                                    }}
                                                    onUploadBegin={() => {
                                                        setUploadingImages(prev => ({ ...prev, [index]: true }));
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>{t("questionTypeLabel")}</Label>
                                        <Select
                                            value={question.type}
                                            onValueChange={(value: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER") => {
                                                if (value === "MULTIPLE_CHOICE" && !Array.isArray(question.correctAnswer)) {
                                                    const updated = [...questions];
                                                    updated[index] = { ...updated[index], type: value, correctAnswer: [0] };
                                                    setQuestions(updated);
                                                } else {
                                                    updateQuestion(index, "type", value);
                                                }
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MULTIPLE_CHOICE">{t("typeMultipleChoice")}</SelectItem>
                                                <SelectItem value="TRUE_FALSE">{t("typeTrueFalse")}</SelectItem>
                                                <SelectItem value="SHORT_ANSWER">{t("typeShortAnswer")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("pointsLabel")}</Label>
                                        <Input
                                            type="number"
                                            value={question.points}
                                            onChange={(e) => updateQuestion(index, "points", parseInt(e.target.value))}
                                            min="1"
                                        />
                                    </div>
                                </div>

                                {question.type === "MULTIPLE_CHOICE" && (
                                    <div className="space-y-2">
                                        <Label>{tCommon("arabicLabel")} — {t("optionsLabel")}</Label>
                                        {(question.options || ["", ""]).map((option, optionIndex) => (
                                            <div key={`${question.id}-option-${optionIndex}`} className="flex items-center gap-2">
                                                <Input
                                                    className="flex-1"
                                                    value={option}
                                                    onChange={(e) => {
                                                        const opts = question.options || ["", ""];
                                                        const newOptions = [...opts];
                                                        newOptions[optionIndex] = e.target.value;
                                                        updateQuestion(index, "options", newOptions);
                                                    }}
                                                    placeholder={t("optionN", { n: optionIndex + 1 })}
                                                />
                                                <div className="flex items-center gap-1 shrink-0" title={t("correctAnswerTitle")}>
                                                    <Checkbox
                                                        id={`correct-${question.id}-${optionIndex}`}
                                                        checked={(Array.isArray(question.correctAnswer) ? question.correctAnswer : []).includes(optionIndex)}
                                                        onCheckedChange={() => toggleCorrectOption(index, optionIndex)}
                                                    />
                                                    <Label htmlFor={`correct-${question.id}-${optionIndex}`} className="text-xs cursor-pointer">{t("correctShort")}</Label>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                                    onClick={() => removeOption(index, optionIndex)}
                                                    disabled={(question.options || ["", ""]).length <= 2}
                                                    title={t("deleteOption")}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Label className="pt-2 block">{tCommon("englishLabel")} — {tEditor("optionsEn")}</Label>
                                        {(question.options || ["", ""]).map((_, optionIndex) => (
                                            <Input
                                                key={`${question.id}-option-en-${optionIndex}`}
                                                dir="ltr"
                                                value={(question.optionsEn || [])[optionIndex] ?? ""}
                                                onChange={(e) => {
                                                    const optsEn = [...(question.optionsEn || [])];
                                                    while (optsEn.length <= optionIndex) optsEn.push("");
                                                    optsEn[optionIndex] = e.target.value;
                                                    updateQuestion(index, "optionsEn", optsEn);
                                                }}
                                                placeholder={t("optionNEn", { n: optionIndex + 1 })}
                                            />
                                        ))}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => addOption(index)}
                                            className="gap-1"
                                        >
                                            <Plus className="h-4 w-4" />
                                            {t("addOption")}
                                        </Button>
                                    </div>
                                )}

                                {question.type === "TRUE_FALSE" && (
                                    <div className="space-y-2">
                                        <Label>{t("correctAnswerLabel")}</Label>
                                        <Select
                                            value={typeof question.correctAnswer === 'string' ? question.correctAnswer : ''}
                                            onValueChange={(value) => updateQuestion(index, "correctAnswer", value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t("selectCorrectAnswer")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="true">{tCommon("true")}</SelectItem>
                                                <SelectItem value="false">{tCommon("false")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {question.type === "SHORT_ANSWER" && (
                                    <div className="space-y-2">
                                        <Label>{t("correctAnswerLabel")}</Label>
                                        <Input
                                            value={typeof question.correctAnswer === 'string' ? question.correctAnswer : ''}
                                            onChange={(e) => updateQuestion(index, "correctAnswer", e.target.value)}
                                            placeholder={t("correctAnswerPlaceholder")}
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>{tCommon("arabicLabel")} — {t("explanationLabel")}</Label>
                                    <Textarea
                                        value={question.explanation ?? ""}
                                        onChange={(e) => updateQuestion(index, "explanation", e.target.value)}
                                        placeholder={t("explanationPlaceholder")}
                                        rows={3}
                                        className="resize-none"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>{tCommon("englishLabel")} — {tEditor("explanationEn")}</Label>
                                    <Textarea
                                        dir="ltr"
                                        value={question.explanationEn ?? ""}
                                        onChange={(e) => updateQuestion(index, "explanationEn", e.target.value)}
                                        placeholder={t("explanationPlaceholderEn")}
                                        rows={3}
                                        className="resize-none"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="flex justify-end space-x-2">
                    <Button
                        variant="outline"
                        onClick={() => router.push(dashboardPath)}
                    >
                        {tCommon("cancel")}
                    </Button>
                    <Button
                        onClick={handleUpdateQuiz}
                        disabled={isUpdatingQuiz || questions.length === 0}
                    >
                        {isUpdatingQuiz ? t("updating") : t("updateQuizBtn")}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EditQuizPage; 