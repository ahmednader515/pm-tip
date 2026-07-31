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
import { usePathname } from "next/navigation";
import { useNavigationRouter } from "@/lib/hooks/use-navigation-router";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { UploadDropzone } from "@/lib/uploadthing";
import { useTranslations } from "next-intl";
import * as XLSX from "xlsx";
import {
    parseMatchingOptions,
    parseMatchingCorrect,
    type MatchingOptions,
} from "@/lib/quiz-question";
// Needed for correct non-English decoding in legacy .xls files (BIFF)
// (Without this, Arabic text can become "????")
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
    description: string;
    courseId: string;
    position: number;
    isPublished: boolean;
    course: {
        title: string;
    };
    questions: Question[];
    createdAt: string;
    updatedAt: string;
}

interface Question {
    id: string;
    text: string;
    textEn?: string;
    imageUrl?: string;
    type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "DROPDOWN" | "MATCHING";
    options?: string[] | MatchingOptions;
    optionsEn?: string[] | MatchingOptions;
    correctAnswer: string | number | number[] | Record<string, string>;
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

const defaultMatchingOptions = (): MatchingOptions => ({
    prompts: ["", ""],
    answers: ["", "", ""],
});

const asMatchingOptions = (value: Question["options"] | Question["optionsEn"]): MatchingOptions => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return {
            prompts: Array.isArray(value.prompts) ? [...value.prompts] : ["", ""],
            answers: Array.isArray(value.answers) ? [...value.answers] : ["", "", ""],
        };
    }
    return defaultMatchingOptions();
};

const asOptionList = (value: Question["options"] | Question["optionsEn"]): string[] => {
    if (Array.isArray(value)) return [...value];
    return ["", ""];
};

const asCorrectMap = (value: Question["correctAnswer"]): Record<string, string> => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return { ...(value as Record<string, string>) };
    }
    return {};
};

const CreateQuizPage = () => {
    const router = useNavigationRouter();
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
    const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
    const [uploadingImages, setUploadingImages] = useState<{ [key: string]: boolean }>({});
    const [listeningQuestionId, setListeningQuestionId] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const [importingExcel, setImportingExcel] = useState(false);
    const [suggestingEnglish, setSuggestingEnglish] = useState(false);

    const normalizeType = (raw: any): Question["type"] => {
        const v = String(raw ?? "").trim().toUpperCase();
        if (v === "MCQ" || v === "MULTIPLE_CHOICE" || v === "MULTIPLE" || v === "CHOICE" || v === "اختيار" || v === "اختيار من متعدد") return "MULTIPLE_CHOICE";
        if (v === "TF" || v === "TRUE_FALSE" || v === "TRUE/FALSE" || v === "صح/خطأ" || v === "صح" || v === "خطأ") return "TRUE_FALSE";
        if (v === "SHORT" || v === "SHORT_ANSWER" || v === "SA" || v === "إجابة قصيرة") return "SHORT_ANSWER";
        if (v === "DROPDOWN" || v === "DD" || v === "قائمة منسدلة" || v === "منسدلة") return "DROPDOWN";
        if (v === "MATCHING" || v === "MATCH" || v === "توصيل" || v === "مطابقة") return "MATCHING";
        return "MULTIPLE_CHOICE";
    };

    const parseMatchingOptionsExcel = (raw: unknown): MatchingOptions => {
        const s = String(raw ?? "").trim();
        if (!s) return { prompts: [], answers: [] };
        try {
            const parsed = JSON.parse(s);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return {
                    prompts: Array.isArray(parsed.prompts) ? parsed.prompts.map(String).map((x) => x.trim()).filter(Boolean) : [],
                    answers: Array.isArray(parsed.answers) ? parsed.answers.map(String).map((x) => x.trim()).filter(Boolean) : [],
                };
            }
        } catch {
            /* ignore */
        }
        const promptsMatch = s.match(/prompts\s*:\s*([\s\S]*?)(?:\s*;;\s*answers\s*:|$)/i);
        const answersMatch = s.match(/answers\s*:\s*([\s\S]*?)$/i);
        const splitPipe = (x: string) =>
            x
                .split("|")
                .map((t) => t.trim())
                .filter(Boolean);
        return {
            prompts: promptsMatch ? splitPipe(promptsMatch[1]) : [],
            answers: answersMatch ? splitPipe(answersMatch[1]) : [],
        };
    };

    const parseMatchingCorrectExcel = (raw: unknown): Record<string, string> => {
        const s = String(raw ?? "").trim();
        if (!s) return {};
        try {
            const parsed = JSON.parse(s);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parseMatchingCorrect(parsed);
            }
        } catch {
            /* ignore */
        }
        const out: Record<string, string> = {};
        for (const part of s.split(/[\|\;\n]+/g)) {
            const eq = part.indexOf("=");
            if (eq <= 0) continue;
            const k = part.slice(0, eq).trim();
            const v = part.slice(eq + 1).trim();
            if (k && v) out[k] = v;
        }
        return out;
    };

    const splitOptions = (raw: any): string[] => {
        if (raw == null) return [];
        if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
        const s = String(raw).trim();
        if (!s) return [];
        // allow | ; , and newlines
        return s
            .split(/[\|\;\n,]+/g)
            .map((x) => x.trim())
            .filter(Boolean);
    };

    const parseCorrectIndices = (raw: any, options: string[]): number[] => {
        const s = String(raw ?? "").trim();
        if (!s) return [0];
        // allow: "1" or "1,3" (1-based), or exact option texts separated by |/;/
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

    const parseTrueFalse = (raw: any): "true" | "false" => {
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

            // Excel files preserve Unicode well. CSV files are often saved in a Windows codepage (e.g. CP1256),
            // which can turn Arabic into "????" if decoded as UTF-8. We try UTF-8 first, then fall back.
            let wb: XLSX.WorkBook;
            if (ext === "csv") {
                const bytes = new Uint8Array(buf);
                const decode = (enc: string) => new TextDecoder(enc as any, { fatal: false }).decode(bytes);

                const hasUtf16leBom = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
                const hasUtf16beBom = bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;
                const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;

                const candidates: { enc: string; text: string }[] = [];
                // Try likely encodings first
                if (hasUtf16leBom) candidates.push({ enc: "utf-16le", text: decode("utf-16le") });
                if (hasUtf16beBom) candidates.push({ enc: "utf-16be", text: decode("utf-16be") });
                if (hasUtf8Bom) candidates.push({ enc: "utf-8", text: decode("utf-8") });

                // Heuristics: many NUL bytes usually means UTF-16LE without BOM
                const nulCount = bytes.reduce((acc, b) => acc + (b === 0 ? 1 : 0), 0);
                const looksLikeUtf16 = nulCount > Math.max(10, Math.floor(bytes.length / 20));
                if (looksLikeUtf16 && !hasUtf16leBom && !hasUtf16beBom) {
                    candidates.push({ enc: "utf-16le", text: decode("utf-16le") });
                }

                // Always include utf-8 and windows-1256 fallback
                candidates.push({ enc: "utf-8", text: decode("utf-8") });
                candidates.push({ enc: "windows-1256", text: decode("windows-1256") });

                const score = (t: string) => {
                    const replacement = (t.match(/\uFFFD/g)?.length ?? 0);
                    const questionMarks = (t.match(/\?{3,}/g)?.length ?? 0); // runs of ????
                    const arabic = (t.match(/[\u0600-\u06FF]/g)?.length ?? 0);
                    // Prefer Arabic presence + fewer corruption indicators
                    return arabic * 3 - replacement * 10 - questionMarks * 5;
                };

                const best = candidates
                    .map((c) => ({ ...c, s: score(c.text) }))
                    .sort((a, b) => b.s - a.s)[0];

                const text = best?.text ?? decode("utf-8");
                const hasArabic = /[\u0600-\u06FF]/.test(text);
                const hasQuestionRuns = /\?{3,}/.test(text);
                if (!hasArabic && hasQuestionRuns) {
                    toast.error(t("csvEncodingError"));
                }
                wb = XLSX.read(text, { type: "string" });
            } else {
                wb = XLSX.read(buf, { type: "array" });
            }
            const sheetName = wb.SheetNames[0];
            const sheet = wb.Sheets[sheetName];
            if (!sheet) throw new Error("No sheet");

            const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
            if (!rows.length) {
                toast.error(t("excelEmpty"));
                return;
            }

            // Supported headers (case-insensitive):
            // text, type, points, options, correct, explanation
            const normalizeKey = (k: string) => k.trim().toLowerCase();
            const get = (row: Record<string, any>, key: string) => {
                const want = normalizeKey(key);
                const found = Object.keys(row).find((rk) => normalizeKey(rk) === want);
                return found ? row[found] : "";
            };

            const imported: Question[] = [];
            const errors: string[] = [];

            rows.forEach((row, idx) => {
                const rowNum = idx + 2; // assuming headers in row 1
                const text = String(get(row, "text") ?? "").trim();
                if (!text) {
                    errors.push(t("rowTextRequired", { row: rowNum }));
                    return;
                }

                const type = normalizeType(get(row, "type"));
                const pointsRaw = get(row, "points");
                const points = Math.max(1, Number(pointsRaw) ? Math.floor(Number(pointsRaw)) : 1);
                const explanation = String(get(row, "explanation") ?? "").trim();
                const explanationEn = String(get(row, "explanationEn") ?? "").trim();
                const textEn = String(get(row, "textEn") ?? "").trim();

                if (type === "MULTIPLE_CHOICE" || type === "DROPDOWN") {
                    const options = splitOptions(get(row, "options"));
                    if (options.length < 2) {
                        errors.push(t("rowOptionsMin", { row: rowNum }));
                        return;
                    }
                    const optionsEnRaw = splitOptions(get(row, "optionsEn"));
                    const optionsEn = options.map((_, i) => optionsEnRaw[i] ?? "");
                    let correct = parseCorrectIndices(get(row, "correct"), options);
                    if (type === "DROPDOWN") correct = [correct[0] ?? 0];
                    imported.push({
                        id: `import-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
                        text,
                        textEn,
                        type,
                        options,
                        optionsEn,
                        correctAnswer: correct,
                        explanation,
                        explanationEn,
                        points,
                    });
                } else if (type === "TRUE_FALSE") {
                    const correct = parseTrueFalse(get(row, "correct"));
                    imported.push({
                        id: `import-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
                        text,
                        textEn,
                        type,
                        correctAnswer: correct,
                        explanation,
                        explanationEn,
                        points,
                    });
                } else if (type === "MATCHING") {
                    const matching = parseMatchingOptionsExcel(get(row, "options"));
                    const matchingEn = parseMatchingOptionsExcel(get(row, "optionsEn"));
                    if (matching.prompts.length < 2) {
                        errors.push(t("rowOptionsMin", { row: rowNum }));
                        return;
                    }
                    if (matching.answers.length < matching.prompts.length) {
                        errors.push(t("rowOptionsMin", { row: rowNum }));
                        return;
                    }
                    const correct = parseMatchingCorrectExcel(get(row, "correct"));
                    imported.push({
                        id: `import-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
                        text,
                        textEn,
                        type,
                        options: matching,
                        optionsEn: {
                            prompts: matching.prompts.map((_, i) => matchingEn.prompts[i] ?? ""),
                            answers: matching.answers.map((_, i) => matchingEn.answers[i] ?? ""),
                        },
                        correctAnswer: correct,
                        explanation,
                        explanationEn,
                        points: matching.prompts.length,
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
                        textEn,
                        type,
                        correctAnswer: correct,
                        explanation,
                        explanationEn,
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
        
        // Check if courseId is provided in URL params
        const urlParams = new URLSearchParams(window.location.search);
        const courseIdFromUrl = urlParams.get('courseId');
        if (courseIdFromUrl) {
            setSelectedCourse(courseIdFromUrl);
            fetchCourseItems(courseIdFromUrl);
        }
    }, []);

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
                const list = Array.isArray(data) ? data : [];
                setCourses(list.filter((course: Course) => course.isPublished));
            }
        } catch (error) {
            console.error("Error fetching courses:", error);
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
            
            // Add the new quiz item to the end of the list
            const itemsWithNewQuiz = [
                ...items,
                {
                    id: "new-quiz",
                    title: quizTitle || t("newQuizDefault"),
                    type: "quiz" as const,
                    position: items.length + 1,
                    isPublished: false
                }
            ];
            
            setCourseItems(itemsWithNewQuiz);
            setChapters(chaptersData);
            
            // Set the new quiz position to be the last position by default
            const lastPosition = items.length + 1;
            setSelectedPosition(lastPosition);
        } catch (error) {
            console.error("Error fetching course items:", error);
            // Clear items on error
            setCourseItems([]);
            setSelectedPosition(1);
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

    const handleCreateQuiz = async () => {
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
            if (question.type === "MULTIPLE_CHOICE" || question.type === "DROPDOWN") {
                const validOptions = asOptionList(question.options).filter((option) => option.trim() !== "");
                if (validOptions.length < 2) {
                    validationErrors.push(t("validationOptionsMin", { n: i + 1 }));
                    continue;
                }
                const correctArr = Array.isArray(question.correctAnswer)
                    ? question.correctAnswer
                    : typeof question.correctAnswer === "number"
                    ? [question.correctAnswer]
                    : [];
                if (
                    correctArr.length === 0 ||
                    correctArr.some((idx) => typeof idx !== "number" || idx < 0 || idx >= validOptions.length)
                ) {
                    validationErrors.push(t("validationCorrectMcq", { n: i + 1 }));
                    continue;
                }
                if (question.type === "DROPDOWN" && correctArr.length !== 1) {
                    validationErrors.push(t("validationCorrectDropdown", { n: i + 1 }));
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
            } else if (question.type === "MATCHING") {
                const matching = parseMatchingOptions(asMatchingOptions(question.options));
                if (matching.prompts.length < 2 || matching.answers.length < matching.prompts.length) {
                    validationErrors.push(t("validationOptionsMin", { n: i + 1 }));
                    continue;
                }
                const correct = parseMatchingCorrect(asCorrectMap(question.correctAnswer));
                const used = new Set<string>();
                let matchingOk = true;
                for (const prompt of matching.prompts) {
                    const ans = correct[prompt];
                    if (!ans || !matching.answers.includes(ans) || used.has(ans)) {
                        matchingOk = false;
                        break;
                    }
                    used.add(ans);
                }
                if (!matchingOk) {
                    validationErrors.push(t("validationMatching", { n: i + 1 }));
                    continue;
                }
            }

            // Check if points are valid
            if (question.type !== "MATCHING" && question.points <= 0) {
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
            if ((question.type === "MULTIPLE_CHOICE" || question.type === "DROPDOWN") && Array.isArray(question.options)) {
                const optsEn = asOptionList(question.optionsEn);
                const paired = question.options
                    .map((option, i) => ({ option, en: optsEn[i] ?? "" }))
                    .filter(({ option }) => option.trim() !== "");
                const correctArr = Array.isArray(question.correctAnswer)
                    ? question.correctAnswer
                    : typeof question.correctAnswer === "number"
                    ? [question.correctAnswer]
                    : [0];
                return {
                    ...question,
                    options: paired.map((p) => p.option),
                    optionsEn: paired.map((p) => p.en),
                    correctAnswer:
                        question.type === "DROPDOWN"
                            ? [correctArr[0] ?? 0]
                            : correctArr,
                };
            }
            if (question.type === "MATCHING") {
                const opts = asMatchingOptions(question.options);
                const optsEn = asMatchingOptions(question.optionsEn);
                const prompts = opts.prompts.map((p) => p.trim()).filter(Boolean);
                const answers = opts.answers.map((a) => a.trim()).filter(Boolean);
                const promptsEn = opts.prompts.map((_, i) => (optsEn.prompts[i] ?? "").trim());
                const answersEn = opts.answers.map((_, i) => (optsEn.answers[i] ?? "").trim());
                const correct = parseMatchingCorrect(asCorrectMap(question.correctAnswer));
                const cleanedCorrect: Record<string, string> = {};
                for (const prompt of prompts) {
                    if (correct[prompt] && answers.includes(correct[prompt])) {
                        cleanedCorrect[prompt] = correct[prompt];
                    }
                }
                return {
                    ...question,
                    options: { prompts, answers },
                    optionsEn: {
                        prompts: prompts.map((_, i) => promptsEn[i] ?? ""),
                        answers: answers.map((_, i) => answersEn[i] ?? ""),
                    },
                    correctAnswer: cleanedCorrect,
                    points: prompts.length,
                };
            }
            return question;
        });

        setIsCreatingQuiz(true);
        try {
            const response = await fetch("/api/teacher/quizzes", {
                method: "POST",
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
                toast.success(t("createSuccess"));
                router.push(dashboardPath);
            } else {
                const error = await response.json().catch(() => ({} as { error?: string; message?: string }));
                toast.error(error.error || error.message || t("createError"));
            }
        } catch (error) {
            console.error("Error creating quiz:", error);
            toast.error(t("createError"));
        } finally {
            setIsCreatingQuiz(false);
        }
    };

    const addQuestion = () => {
        const newQuestion: Question = {
            id: `question-${Date.now()}`,
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
            if (q.type === "MULTIPLE_CHOICE" || q.type === "DROPDOWN") {
                asOptionList(q.options).forEach((opt, oi) => {
                    texts.push(opt || "");
                    meta.push({ kind: "option", qi, oi });
                });
            } else if (q.type === "MATCHING") {
                const matching = asMatchingOptions(q.options);
                matching.prompts.forEach((p, oi) => {
                    texts.push(p || "");
                    meta.push({ kind: "matchPrompt", qi, oi });
                });
                matching.answers.forEach((a, oi) => {
                    texts.push(a || "");
                    meta.push({ kind: "matchAnswer", qi, oi });
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
            const nextQuestions = questions.map((q) => {
                if (q.type === "MATCHING") {
                    const ar = asMatchingOptions(q.options);
                    const en = asMatchingOptions(q.optionsEn);
                    return {
                        ...q,
                        optionsEn: {
                            prompts: ar.prompts.map((_, i) => en.prompts[i] ?? ""),
                            answers: ar.answers.map((_, i) => en.answers[i] ?? ""),
                        },
                    };
                }
                if (q.type === "MULTIPLE_CHOICE" || q.type === "DROPDOWN") {
                    const opts = asOptionList(q.options);
                    const optsEn = asOptionList(q.optionsEn);
                    return {
                        ...q,
                        optionsEn: opts.map((_, i) => optsEn[i] ?? ""),
                    };
                }
                return { ...q };
            });
            translations.forEach((tr, i) => {
                const m = meta[i];
                if (!m) return;
                if (m.kind === "title") setQuizTitleEn(tr);
                else if (m.kind === "description") setQuizDescriptionEn(tr);
                else if (m.kind === "text" && m.qi != null) nextQuestions[m.qi].textEn = tr;
                else if (m.kind === "explanation" && m.qi != null) nextQuestions[m.qi].explanationEn = tr;
                else if (m.kind === "option" && m.qi != null && m.oi != null) {
                    const opts = asOptionList(nextQuestions[m.qi].optionsEn);
                    while (opts.length <= m.oi) opts.push("");
                    opts[m.oi] = tr;
                    nextQuestions[m.qi].optionsEn = opts;
                } else if (m.kind === "matchPrompt" && m.qi != null && m.oi != null) {
                    const en = asMatchingOptions(nextQuestions[m.qi].optionsEn);
                    while (en.prompts.length <= m.oi) en.prompts.push("");
                    en.prompts[m.oi] = tr;
                    nextQuestions[m.qi].optionsEn = en;
                } else if (m.kind === "matchAnswer" && m.qi != null && m.oi != null) {
                    const en = asMatchingOptions(nextQuestions[m.qi].optionsEn);
                    while (en.answers.length <= m.oi) en.answers.push("");
                    en.answers[m.oi] = tr;
                    nextQuestions[m.qi].optionsEn = en;
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
        const currentOptions = asOptionList(question.options);
        const currentOptionsEn = asOptionList(question.optionsEn);
        while (currentOptionsEn.length < currentOptions.length) currentOptionsEn.push("");
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
        const currentOptions = asOptionList(question.options);
        if (currentOptions.length <= 2) return;
        const newOptions = currentOptions.filter((_, i) => i !== optionIndex);
        const newOptionsEn = asOptionList(question.optionsEn).filter((_, i) => i !== optionIndex);
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
            correctAnswer:
                question.type === "DROPDOWN"
                    ? [newCorrect[0] ?? 0]
                    : newCorrect.length
                    ? newCorrect
                    : [0],
        };
        const updatedQuestions = [...questions];
        updatedQuestions[questionIndex] = updated;
        setQuestions(updatedQuestions);
    };

    const toggleCorrectOption = (questionIndex: number, optionIndex: number) => {
        const question = questions[questionIndex];
        if (question.type === "DROPDOWN") {
            updateQuestion(questionIndex, "correctAnswer", [optionIndex]);
            return;
        }
        const current = Array.isArray(question.correctAnswer)
            ? question.correctAnswer
            : typeof question.correctAnswer === "number"
            ? [question.correctAnswer]
            : [0];
        const set = new Set(current);
        if (set.has(optionIndex)) set.delete(optionIndex);
        else set.add(optionIndex);
        const newCorrect = Array.from(set).sort((a, b) => a - b);
        if (newCorrect.length === 0) return; // require at least one
        updateQuestion(questionIndex, "correctAnswer", newCorrect);
    };

    const applyQuestionTypeChange = (index: number, value: Question["type"]) => {
        const question = questions[index];
        const updatedQuestions = [...questions];
        let next: Question = { ...question, type: value };

        if (value === "MULTIPLE_CHOICE" || value === "DROPDOWN") {
            const opts = Array.isArray(question.options) ? asOptionList(question.options) : ["", ""];
            const optsEn = Array.isArray(question.optionsEn)
                ? asOptionList(question.optionsEn)
                : opts.map(() => "");
            let correct: number[] = Array.isArray(question.correctAnswer)
                ? (question.correctAnswer as number[]).filter((n) => typeof n === "number")
                : typeof question.correctAnswer === "number"
                ? [question.correctAnswer]
                : [0];
            if (value === "DROPDOWN") {
                correct = [correct[0] ?? 0];
            } else if (!correct.length) {
                correct = [0];
            }
            next = {
                ...next,
                options: opts.length >= 2 ? opts : ["", ""],
                optionsEn: optsEn.length >= 2 ? optsEn : ["", ""],
                correctAnswer: correct,
                points: question.points > 0 ? question.points : 1,
            };
        } else if (value === "TRUE_FALSE") {
            next = {
                ...next,
                options: undefined,
                optionsEn: undefined,
                correctAnswer:
                    question.correctAnswer === "true" || question.correctAnswer === "false"
                        ? question.correctAnswer
                        : "true",
                points: question.points > 0 ? question.points : 1,
            };
        } else if (value === "SHORT_ANSWER") {
            next = {
                ...next,
                options: undefined,
                optionsEn: undefined,
                correctAnswer: typeof question.correctAnswer === "string" ? question.correctAnswer : "",
                points: question.points > 0 ? question.points : 1,
            };
        } else if (value === "MATCHING") {
            next = {
                ...next,
                options: defaultMatchingOptions(),
                optionsEn: defaultMatchingOptions(),
                correctAnswer: {},
                points: 2,
            };
        }

        updatedQuestions[index] = next;
        setQuestions(updatedQuestions);
    };

    const updateQuestion = (index: number, field: keyof Question, value: any) => {
        if (field === "type") {
            applyQuestionTypeChange(index, value as Question["type"]);
            return;
        }
        const updatedQuestions = [...questions];
        updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
        setQuestions(updatedQuestions);
    };

    const updateMatchingField = (
        questionIndex: number,
        side: "prompts" | "answers",
        lang: "ar" | "en",
        itemIndex: number,
        value: string
    ) => {
        const question = questions[questionIndex];
        const opts = asMatchingOptions(question.options);
        const optsEn = asMatchingOptions(question.optionsEn);
        let correct = asCorrectMap(question.correctAnswer);

        if (lang === "ar") {
            const list = [...opts[side]];
            const oldValue = list[itemIndex] ?? "";
            list[itemIndex] = value;
            if (side === "prompts" && oldValue !== value) {
                if (oldValue && oldValue in correct) {
                    correct = { ...correct, [value]: correct[oldValue] };
                    delete correct[oldValue];
                }
            } else if (side === "answers" && oldValue !== value) {
                const remapped: Record<string, string> = {};
                for (const [k, v] of Object.entries(correct)) {
                    remapped[k] = v === oldValue ? value : v;
                }
                correct = remapped;
            }
            const updatedQuestions = [...questions];
            updatedQuestions[questionIndex] = {
                ...question,
                options: { ...opts, [side]: list },
                correctAnswer: correct,
                points: side === "prompts" ? list.filter((p) => p.trim()).length || 2 : question.points,
            };
            setQuestions(updatedQuestions);
        } else {
            const list = [...optsEn[side]];
            list[itemIndex] = value;
            updateQuestion(questionIndex, "optionsEn", { ...optsEn, [side]: list });
        }
    };

    const addMatchingItem = (questionIndex: number, side: "prompts" | "answers") => {
        const question = questions[questionIndex];
        const opts = asMatchingOptions(question.options);
        const optsEn = asMatchingOptions(question.optionsEn);
        const updatedQuestions = [...questions];
        updatedQuestions[questionIndex] = {
            ...question,
            options: { ...opts, [side]: [...opts[side], ""] },
            optionsEn: { ...optsEn, [side]: [...optsEn[side], ""] },
            points: side === "prompts" ? opts.prompts.length + 1 : question.points,
        };
        setQuestions(updatedQuestions);
    };

    const removeMatchingItem = (questionIndex: number, side: "prompts" | "answers", itemIndex: number) => {
        const question = questions[questionIndex];
        const opts = asMatchingOptions(question.options);
        const optsEn = asMatchingOptions(question.optionsEn);
        if (side === "prompts" && opts.prompts.length <= 2) return;
        if (side === "answers" && opts.answers.length <= Math.max(2, opts.prompts.length)) return;

        const removedAr = opts[side][itemIndex] ?? "";
        const nextSide = opts[side].filter((_, i) => i !== itemIndex);
        const nextSideEn = optsEn[side].filter((_, i) => i !== itemIndex);
        let correct = asCorrectMap(question.correctAnswer);
        if (side === "prompts") {
            const { [removedAr]: _, ...rest } = correct;
            correct = rest;
        } else {
            const remapped: Record<string, string> = {};
            for (const [k, v] of Object.entries(correct)) {
                if (v !== removedAr) remapped[k] = v;
            }
            correct = remapped;
        }
        const updatedQuestions = [...questions];
        updatedQuestions[questionIndex] = {
            ...question,
            options: { ...opts, [side]: nextSide },
            optionsEn: { ...optsEn, [side]: nextSideEn },
            correctAnswer: correct,
            points: side === "prompts" ? nextSide.filter((p) => p.trim()).length || 2 : question.points,
        };
        setQuestions(updatedQuestions);
    };

    const setMatchingCorrect = (questionIndex: number, promptIndex: number, answer: string) => {
        const question = questions[questionIndex];
        const opts = asMatchingOptions(question.options);
        const prompt = opts.prompts[promptIndex] ?? "";
        if (!prompt.trim()) return;
        const correct = asCorrectMap(question.correctAnswer);
        // Ensure uniqueness: clear this answer from other prompts
        for (const [k, v] of Object.entries(correct)) {
            if (v === answer && k !== prompt) delete correct[k];
        }
        correct[prompt] = answer;
        updateQuestion(questionIndex, "correctAnswer", correct);
    };

    const isMatchingIncomplete = (question: Question) => {
        const matching = parseMatchingOptions(asMatchingOptions(question.options));
        if (matching.prompts.length < 2) return true;
        if (matching.answers.length < matching.prompts.length) return true;
        const correct = parseMatchingCorrect(asCorrectMap(question.correctAnswer));
        const used = new Set<string>();
        for (const prompt of matching.prompts) {
            const ans = correct[prompt];
            if (!ans || !matching.answers.includes(ans) || used.has(ans)) return true;
            used.add(ans);
        }
        return false;
    };

    const removeQuestion = (index: number) => {
        if (questions[index]?.id === listeningQuestionId) {
            stopListening();
        }
        const updatedQuestions = questions.filter((_, i) => i !== index);
        setQuestions(updatedQuestions);
    };

    const handleDragEnd = (result: any) => {
        if (!result.destination) return;

        // Only handle dragging the "new-quiz" item
        if (result.draggableId === "new-quiz") {
            // Calculate the position for the new quiz based on where it was dropped
            const newQuizPosition = result.destination.index + 1;
            setSelectedPosition(newQuizPosition);
            
            // Reorder the items array to reflect the new position
            const reorderedItems = Array.from(courseItems);
            const [movedItem] = reorderedItems.splice(result.source.index, 1);
            reorderedItems.splice(result.destination.index, 0, movedItem);
            
            setCourseItems(reorderedItems);
        }
        // For existing items, we don't want to reorder them, so we ignore the drag
        // The drag and drop library will handle the visual feedback, but we don't update state
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {t("createTitle")}
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
                            setSelectedPosition(1);
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
                            onChange={(e) => {
                                setQuizTitle(e.target.value);
                                // Update the new quiz item in the course items list
                                setCourseItems(prev => 
                                    prev.map(item => 
                                        item.id === "new-quiz" 
                                            ? { ...item, title: e.target.value || t("newQuizDefault") }
                                            : item
                                    )
                                );
                            }}
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
                                {t("reorderHintCreate")}
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
                                                                } ${item.id === "new-quiz" ? "border-2 border-dashed border-blue-300 bg-blue-50" : ""}`}
                                                            >
                                                                <div className="flex items-center space-x-3">
                                                                    <div {...provided.dragHandleProps} className={item.id === "new-quiz" ? "cursor-grab active:cursor-grabbing" : ""}>
                                                                        <GripVertical className={`h-4 w-4 ${item.id === "new-quiz" ? "text-blue-600" : "text-gray-300 cursor-not-allowed"}`} />
                                                                    </div>
                                                                    <div>
                                                                        <div className={`font-medium ${item.id === "new-quiz" ? "text-blue-800" : ""}`}>
                                                                            {item.title}
                                                                        </div>
                                                                        <div className={`text-sm ${item.id === "new-quiz" ? "text-blue-600" : "text-muted-foreground"}`}>
                                                                            {item.type === "chapter" ? t("chapterType") : t("quizType")}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <Badge variant={item.id === "new-quiz" ? "outline" : (item.isPublished ? "default" : "secondary")} className={item.id === "new-quiz" ? "border-blue-300 text-blue-700" : ""}>
                                                                    {item.id === "new-quiz" ? t("newBadge") : (item.isPublished ? tCommon("published") : tCommon("draft"))}
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
                                            <Badge variant="outline" className="border-blue-300 text-blue-700">
                                                {t("newBadge")}
                                            </Badge>
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
                            <a
                                href="/quiz-import-example.xlsx"
                                download
                                className="text-sm text-primary underline underline-offset-2"
                            >
                                {t("downloadSampleExcel")}
                            </a>
                        </div>

                        <div className="text-sm text-muted-foreground space-y-2">
                            <div className="font-medium text-foreground">{t("excelFormatTitle")}</div>
                            <ul className="list-disc pr-5 space-y-1">
                                <li><span className="font-medium">text</span>: {t("excelColText")}</li>
                                <li><span className="font-medium">textEn</span>: {t("excelColTextEn")}</li>
                                <li><span className="font-medium">type</span>: {t("excelColType")}</li>
                                <li><span className="font-medium">points</span>: {t("excelColPoints")}</li>
                                <li><span className="font-medium">options</span>: {t("excelColOptions")}</li>
                                <li><span className="font-medium">optionsEn</span>: {t("excelColOptionsEn")}</li>
                                <li><span className="font-medium">correct</span>:</li>
                                <ul className="list-disc pr-5">
                                    <li>{t("excelColCorrectMcq")}</li>
                                    <li>{t("excelColCorrectDropdown")}</li>
                                    <li>{t("excelColCorrectMatching")}</li>
                                    <li>{t("excelColCorrectTf")}</li>
                                    <li>{t("excelColCorrectSa")}</li>
                                </ul>
                                <li><span className="font-medium">explanation</span>: {t("excelColExplanation")}</li>
                                <li><span className="font-medium">explanationEn</span>: {t("excelColExplanationEn")}</li>
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
                                          ((question.type === "MULTIPLE_CHOICE" || question.type === "DROPDOWN") &&
                                           (asOptionList(question.options).filter((opt) => opt.trim() !== "").length < 2)) ||
                                          (question.type === "MULTIPLE_CHOICE" && (!Array.isArray(question.correctAnswer) || question.correctAnswer.length === 0)) ||
                                          (question.type === "DROPDOWN" && (!Array.isArray(question.correctAnswer) || question.correctAnswer.length !== 1)) ||
                                          (question.type === "TRUE_FALSE" &&
                                           (typeof question.correctAnswer !== "string" || (question.correctAnswer !== "true" && question.correctAnswer !== "false"))) ||
                                          (question.type === "SHORT_ANSWER" &&
                                           (typeof question.correctAnswer !== "string" || question.correctAnswer.trim() === "")) ||
                                          (question.type === "MATCHING" && isMatchingIncomplete(question))) && (
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
                                            onValueChange={(value: Question["type"]) => updateQuestion(index, "type", value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MULTIPLE_CHOICE">{t("typeMultipleChoice")}</SelectItem>
                                                <SelectItem value="TRUE_FALSE">{t("typeTrueFalse")}</SelectItem>
                                                <SelectItem value="SHORT_ANSWER">{t("typeShortAnswer")}</SelectItem>
                                                <SelectItem value="DROPDOWN">{t("typeDropdown")}</SelectItem>
                                                <SelectItem value="MATCHING">{t("typeMatching")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("pointsLabel")}</Label>
                                        {question.type === "MATCHING" ? (
                                            <>
                                                <Input
                                                    type="number"
                                                    value={asMatchingOptions(question.options).prompts.filter((p) => p.trim()).length || 2}
                                                    disabled
                                                    min="1"
                                                />
                                                <p className="text-xs text-muted-foreground">{t("matchingPointsHint")}</p>
                                            </>
                                        ) : (
                                            <Input
                                                type="number"
                                                value={question.points}
                                                onChange={(e) => updateQuestion(index, "points", parseInt(e.target.value))}
                                                min="1"
                                            />
                                        )}
                                    </div>
                                </div>

                                {(question.type === "MULTIPLE_CHOICE" || question.type === "DROPDOWN") && (
                                    <div className="space-y-2">
                                        <Label>{tCommon("arabicLabel")} — {t("optionsLabel")}</Label>
                                        {asOptionList(question.options).map((option, optionIndex) => (
                                            <div key={`${question.id}-option-${optionIndex}`} className="flex items-center gap-2">
                                                <Input
                                                    className="flex-1"
                                                    value={option}
                                                    onChange={(e) => {
                                                        const opts = asOptionList(question.options);
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
                                                        onCheckedChange={() => {
                                                            if (question.type === "DROPDOWN") {
                                                                updateQuestion(index, "correctAnswer", [optionIndex]);
                                                            } else {
                                                                toggleCorrectOption(index, optionIndex);
                                                            }
                                                        }}
                                                    />
                                                    <Label htmlFor={`correct-${question.id}-${optionIndex}`} className="text-xs cursor-pointer">{t("correctShort")}</Label>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                                    onClick={() => removeOption(index, optionIndex)}
                                                    disabled={asOptionList(question.options).length <= 2}
                                                    title={t("deleteOption")}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Label className="pt-2 block">{tCommon("englishLabel")} — {tEditor("optionsEn")}</Label>
                                        {asOptionList(question.options).map((_, optionIndex) => (
                                            <Input
                                                key={`${question.id}-option-en-${optionIndex}`}
                                                dir="ltr"
                                                value={asOptionList(question.optionsEn)[optionIndex] ?? ""}
                                                onChange={(e) => {
                                                    const optsEn = asOptionList(question.optionsEn);
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

                                {question.type === "MATCHING" && (() => {
                                    const matching = asMatchingOptions(question.options);
                                    const matchingEn = asMatchingOptions(question.optionsEn);
                                    const correct = asCorrectMap(question.correctAnswer);
                                    return (
                                        <div className="space-y-4">
                                            <p className="text-sm text-muted-foreground">{t("matchingPointsHint")}</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>{t("promptsColumn")}</Label>
                                                    {matching.prompts.map((prompt, promptIndex) => (
                                                        <div key={`${question.id}-prompt-${promptIndex}`} className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    className="flex-1"
                                                                    value={prompt}
                                                                    onChange={(e) => updateMatchingField(index, "prompts", "ar", promptIndex, e.target.value)}
                                                                    placeholder={t("promptN", { n: promptIndex + 1 })}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                                                    onClick={() => removeMatchingItem(index, "prompts", promptIndex)}
                                                                    disabled={matching.prompts.length <= 2}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                            <Input
                                                                dir="ltr"
                                                                value={matchingEn.prompts[promptIndex] ?? ""}
                                                                onChange={(e) => updateMatchingField(index, "prompts", "en", promptIndex, e.target.value)}
                                                                placeholder={t("promptNEn", { n: promptIndex + 1 })}
                                                            />
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">{t("correctMatch")}</Label>
                                                                <Select
                                                                    value={correct[prompt] || ""}
                                                                    onValueChange={(val) => setMatchingCorrect(index, promptIndex, val)}
                                                                    disabled={!prompt.trim()}
                                                                >
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={t("selectMatchAnswer")} />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {matching.answers.filter((a) => a.trim()).map((answer, ai) => (
                                                                            <SelectItem key={`${question.id}-match-ans-${promptIndex}-${ai}`} value={answer}>
                                                                                {answer}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => addMatchingItem(index, "prompts")}
                                                        className="gap-1"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        {t("addPrompt")}
                                                    </Button>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>{t("answersColumn")}</Label>
                                                    {matching.answers.map((answer, answerIndex) => (
                                                        <div key={`${question.id}-answer-${answerIndex}`} className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    className="flex-1"
                                                                    value={answer}
                                                                    onChange={(e) => updateMatchingField(index, "answers", "ar", answerIndex, e.target.value)}
                                                                    placeholder={t("answerN", { n: answerIndex + 1 })}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                                                    onClick={() => removeMatchingItem(index, "answers", answerIndex)}
                                                                    disabled={matching.answers.length <= Math.max(2, matching.prompts.length)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                            <Input
                                                                dir="ltr"
                                                                value={matchingEn.answers[answerIndex] ?? ""}
                                                                onChange={(e) => updateMatchingField(index, "answers", "en", answerIndex, e.target.value)}
                                                                placeholder={t("answerNEn", { n: answerIndex + 1 })}
                                                            />
                                                        </div>
                                                    ))}
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => addMatchingItem(index, "answers")}
                                                        className="gap-1"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        {t("addAnswer")}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

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
                        onClick={handleCreateQuiz}
                        disabled={isCreatingQuiz || questions.length === 0}
                    >
                        {isCreatingQuiz ? t("saving") : t("createQuizBtn")}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CreateQuizPage; 