"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical, X, Mic, FileSpreadsheet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { useNavigationRouter } from "@/lib/hooks/use-navigation-router";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { UploadDropzone } from "@/lib/uploadthing";
import * as XLSX from "xlsx";
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
    imageUrl?: string;
    type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
    options?: string[];
    correctAnswer: string | number | number[]; // TRUE_FALSE/SHORT_ANSWER: string; MULTIPLE_CHOICE: number[] (indices)
    explanation?: string;
    points: number;
}

interface CourseItem {
    id: string;
    title: string;
    type: "chapter" | "quiz";
    position: number;
    isPublished: boolean;
}

const CreateQuizPage = () => {
    const router = useNavigationRouter();
    const pathname = usePathname();
    const dashboardPath = pathname.includes("/dashboard/admin/")
        ? "/dashboard/admin/quizzes"
        : "/dashboard/teacher/quizzes";
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<string>("");
    const [quizTitle, setQuizTitle] = useState("");
    const [quizDescription, setQuizDescription] = useState("");
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

    const normalizeType = (raw: any): Question["type"] => {
        const v = String(raw ?? "").trim().toUpperCase();
        if (v === "MCQ" || v === "MULTIPLE_CHOICE" || v === "MULTIPLE" || v === "CHOICE" || v === "اختيار" || v === "اختيار من متعدد") return "MULTIPLE_CHOICE";
        if (v === "TF" || v === "TRUE_FALSE" || v === "TRUE/FALSE" || v === "صح/خطأ" || v === "صح" || v === "خطأ") return "TRUE_FALSE";
        if (v === "SHORT" || v === "SHORT_ANSWER" || v === "SA" || v === "إجابة قصيرة") return "SHORT_ANSWER";
        return "MULTIPLE_CHOICE";
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
                toast.error("يرجى رفع ملف Excel بصيغة .xlsx فقط (لضمان دعم العربية بدون مشاكل ترميز).");
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
                    toast.error(
                        "هذا الملف CSV يبدو أنه محفوظ بترميز لا يدعم العربية (تم استبدال الأحرف بـ ???). " +
                        "لحل المشكلة: احفظ الملف كـ “CSV UTF-8” أو ارفعه بصيغة .xlsx."
                    );
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
                toast.error("ملف الإكسل فارغ");
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
                    errors.push(`صف ${rowNum}: text مطلوب`);
                    return;
                }

                const type = normalizeType(get(row, "type"));
                const pointsRaw = get(row, "points");
                const points = Math.max(1, Number(pointsRaw) ? Math.floor(Number(pointsRaw)) : 1);
                const explanation = String(get(row, "explanation") ?? "").trim();

                if (type === "MULTIPLE_CHOICE") {
                    const options = splitOptions(get(row, "options"));
                    if (options.length < 2) {
                        errors.push(`صف ${rowNum}: options يجب أن يحتوي على خيارين على الأقل (افصل بـ |)`);
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
                        errors.push(`صف ${rowNum}: correct مطلوب لـ SHORT_ANSWER`);
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
                toast.error(errors.slice(0, 6).join("\n") + (errors.length > 6 ? `\n... وعدد ${errors.length - 6} أخطاء أخرى` : ""));
            }

            if (imported.length) {
                setQuestions((prev) => [...prev, ...imported]);
                toast.success(`تم استيراد ${imported.length} سؤال`);
            } else if (!errors.length) {
                toast.error("لم يتم استيراد أي أسئلة");
            }
        } catch (e) {
            console.error("[IMPORT_EXCEL]", e);
            toast.error("فشل استيراد ملف الإكسل");
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
                const teacherCourses = data.filter((course: Course) => course.isPublished);
                setCourses(teacherCourses);
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
                    title: quizTitle || "اختبار جديد",
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
            toast.error("المتصفح لا يدعم الإملاء الصوتي");
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
                toast.error("تعذر التعرف على الصوت");
            };

            recognition.onend = () => {
                setListeningQuestionId(null);
                recognitionRef.current = null;
            };

            recognitionRef.current = recognition;
            recognition.start();
        } catch (error) {
            console.error("[SPEECH_RECOGNITION]", error);
            toast.error("تعذر بدء التسجيل الصوتي");
            stopListening();
        }
    };

    const handleCreateQuiz = async () => {
        stopListening();
        if (!selectedCourse || !quizTitle.trim()) {
            toast.error("يرجى إدخال جميع البيانات المطلوبة");
            return;
        }

        // Validate questions
        const validationErrors: string[] = [];

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            // Validate question text
            if (!question.text || question.text.trim() === "") {
                validationErrors.push(`السؤال ${i + 1}: نص السؤال مطلوب`);
                continue;
            }

            // Validate correct answer
            if (question.type === "MULTIPLE_CHOICE") {
                const validOptions = question.options?.filter(option => option.trim() !== "") || [];
                if (validOptions.length === 0) {
                    validationErrors.push(`السؤال ${i + 1}: يجب إضافة خيار واحد على الأقل`);
                    continue;
                }
                const correctArr = Array.isArray(question.correctAnswer)
                    ? question.correctAnswer
                    : typeof question.correctAnswer === "number"
                    ? [question.correctAnswer]
                    : [];
                if (correctArr.length === 0 || correctArr.some((idx) => idx < 0 || idx >= validOptions.length)) {
                    validationErrors.push(`السؤال ${i + 1}: يجب اختيار إجابة صحيحة واحدة على الأقل`);
                    continue;
                }
            } else if (question.type === "TRUE_FALSE") {
                if (!question.correctAnswer || (question.correctAnswer !== "true" && question.correctAnswer !== "false")) {
                    validationErrors.push(`السؤال ${i + 1}: يجب اختيار إجابة صحيحة`);
                    continue;
                }
            } else if (question.type === "SHORT_ANSWER") {
                if (!question.correctAnswer || question.correctAnswer.toString().trim() === "") {
                    validationErrors.push(`السؤال ${i + 1}: الإجابة الصحيحة مطلوبة`);
                    continue;
                }
            }

            // Check if points are valid
            if (question.points <= 0) {
                validationErrors.push(`السؤال ${i + 1}: الدرجات يجب أن تكون أكبر من صفر`);
                continue;
            }
        }

        if (validationErrors.length > 0) {
            toast.error(validationErrors.join('\n'));
            return;
        }

        // Additional validation: ensure no questions are empty
        if (questions.length === 0) {
            toast.error("يجب إضافة سؤال واحد على الأقل");
            return;
        }

        // Clean up questions before sending
        const cleanedQuestions = questions.map(question => {
            if (question.type === "MULTIPLE_CHOICE" && question.options) {
                // Filter out empty options and ensure correct answer is included
                const filteredOptions = question.options.filter(option => option.trim() !== "");
                return {
                    ...question,
                    options: filteredOptions
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
                    description: quizDescription,
                    courseId: selectedCourse,
                    questions: cleanedQuestions,
                    position: selectedPosition,
                    timer: quizTimer,
                    maxAttempts: quizMaxAttempts,
                }),
            });

            if (response.ok) {
                toast.success("تم إنشاء الاختبار بنجاح");
                router.push(dashboardPath);
            } else {
                const error = await response.json();
                toast.error(error.message || "حدث خطأ أثناء إنشاء الاختبار");
            }
        } catch (error) {
            console.error("Error creating quiz:", error);
            toast.error("حدث خطأ أثناء إنشاء الاختبار");
        } finally {
            setIsCreatingQuiz(false);
        }
    };

    const addQuestion = () => {
        const newQuestion: Question = {
            id: `question-${Date.now()}`,
            text: "",
            type: "MULTIPLE_CHOICE",
            options: ["", ""],
            correctAnswer: [0],
            explanation: "",
            points: 1,
        };
        setQuestions([...questions, newQuestion]);
    };

    const addOption = (questionIndex: number) => {
        const question = questions[questionIndex];
        const currentOptions = question.options || ["", ""];
        updateQuestion(questionIndex, "options", [...currentOptions, ""]);
    };

    const removeOption = (questionIndex: number, optionIndex: number) => {
        const question = questions[questionIndex];
        const currentOptions = question.options || ["", ""];
        if (currentOptions.length <= 2) return;
        const newOptions = currentOptions.filter((_, i) => i !== optionIndex);
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
        if (newCorrect.length === 0) return; // require at least one
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
                    إنشاء اختبار جديد
                </h1>
                <Button variant="outline" onClick={() => router.push(dashboardPath)}>
                    العودة إلى الاختبارات
                </Button>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>اختر الكورس</Label>
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
                                <SelectValue placeholder="اختر كورس..." />
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
                        <Label>عنوان الاختبار</Label>
                        <Input
                            value={quizTitle}
                            onChange={(e) => {
                                setQuizTitle(e.target.value);
                                // Update the new quiz item in the course items list
                                setCourseItems(prev => 
                                    prev.map(item => 
                                        item.id === "new-quiz" 
                                            ? { ...item, title: e.target.value || "اختبار جديد" }
                                            : item
                                    )
                                );
                            }}
                            placeholder="أدخل عنوان الاختبار"
                        />
                    </div>
                </div>

                {selectedCourse && (
                    <Card>
                        <CardHeader>
                            <CardTitle>ترتيب الاختبار في الكورس</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                اسحب الاختبار الجديد إلى الموقع المطلوب بين الفصول والاختبارات الموجودة
                            </p>
                            <p className="text-sm text-blue-600">
                                الموقع المحدد: {selectedPosition}
                            </p>
                        </CardHeader>
                        <CardContent>
                            {isLoadingCourseItems ? (
                                <div className="text-center py-8">
                                    <div className="text-muted-foreground">جاري تحميل محتوى الكورس...</div>
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
                                                                            {item.type === "chapter" ? "فصل" : "اختبار"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <Badge variant={item.id === "new-quiz" ? "outline" : (item.isPublished ? "default" : "secondary")} className={item.id === "new-quiz" ? "border-blue-300 text-blue-700" : ""}>
                                                                    {item.id === "new-quiz" ? "جديد" : (item.isPublished ? "منشور" : "مسودة")}
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
                                        لا توجد فصول أو اختبارات في هذه الكورس. سيتم إضافة الاختبار في الموقع الأول.
                                    </p>
                                    <div className="p-3 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
                                        <div className="flex items-center justify-center space-x-3">
                                            <div>
                                                <div className="font-medium text-blue-800">
                                                    {quizTitle || "اختبار جديد"}
                                                </div>
                                                <div className="text-sm text-blue-600">اختبار</div>
                                            </div>
                                            <Badge variant="outline" className="border-blue-300 text-blue-700">
                                                جديد
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-2">
                    <Label>وصف الاختبار</Label>
                    <Textarea
                        value={quizDescription}
                        onChange={(e) => setQuizDescription(e.target.value)}
                        placeholder="أدخل وصف الاختبار"
                        rows={3}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>مدة الاختبار (بالدقائق)</Label>
                        <Input
                            type="number"
                            value={quizTimer || ""}
                            onChange={(e) => setQuizTimer(e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="اترك فارغاً لعدم تحديد مدة"
                            min="1"
                        />
                        <p className="text-sm text-muted-foreground">
                            اترك الحقل فارغاً إذا كنت لا تريد تحديد مدة للاختبار
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label>عدد المحاولات المسموحة</Label>
                        <Input
                            type="number"
                            value={quizMaxAttempts}
                            onChange={(e) => setQuizMaxAttempts(parseInt(e.target.value))}
                            min="1"
                            max="10"
                        />
                        <p className="text-sm text-muted-foreground">
                            عدد المرات التي يمكن للطالب إعادة الاختبار
                        </p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5" />
                            استيراد الأسئلة من Excel
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
                            <div className="font-medium text-foreground">تنسيق ملف الإكسل (أعمدة مطلوبة):</div>
                            <ul className="list-disc pr-5 space-y-1">
                                <li><span className="font-medium">text</span>: نص السؤال</li>
                                <li><span className="font-medium">type</span>: نوع السؤال: <span className="font-mono">MULTIPLE_CHOICE</span> أو <span className="font-mono">TRUE_FALSE</span> أو <span className="font-mono">SHORT_ANSWER</span></li>
                                <li><span className="font-medium">points</span>: الدرجات (اختياري، الافتراضي 1)</li>
                                <li><span className="font-medium">options</span>: (لـ MULTIPLE_CHOICE فقط) الخيارات مفصولة بـ <span className="font-mono">|</span> مثل <span className="font-mono">A|B|C|D</span></li>
                                <li><span className="font-medium">correct</span>:</li>
                                <ul className="list-disc pr-5">
                                    <li>لـ MULTIPLE_CHOICE: أرقام 1-based مفصولة بـ <span className="font-mono">,</span> أو <span className="font-mono">|</span> مثل <span className="font-mono">1</span> أو <span className="font-mono">1,3</span> (يدعم تعدد الإجابات الصحيحة)</li>
                                    <li>لـ TRUE_FALSE: <span className="font-mono">true</span>/<span className="font-mono">false</span> أو <span className="font-mono">صح</span>/<span className="font-mono">خطأ</span></li>
                                    <li>لـ SHORT_ANSWER: النص الصحيح</li>
                                </ul>
                                <li><span className="font-medium">explanation</span>: شرح الإجابة الصحيحة (اختياري)</li>
                            </ul>
                            <div className="text-xs">
                                ملاحظة: يتم قبول ملفات <span className="font-mono">.xlsx</span> فقط لتجنب مشاكل ترميز العربية. أول ورقة فقط يتم قراءتها، وأسماء الأعمدة غير حساسة لحالة الأحرف.
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>الأسئلة</Label>
                        <Button type="button" variant="outline" onClick={addQuestion}>
                            <Plus className="h-4 w-4 mr-2" />
                            إضافة سؤال
                        </Button>
                    </div>

                    {questions.map((question, index) => (
                        <Card key={question.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg">السؤال {index + 1}</CardTitle>
                                        {(!question.text.trim() ||
                                          (question.type === "MULTIPLE_CHOICE" &&
                                           (!question.options || question.options.filter(opt => opt.trim() !== "").length < 2)) ||
                                          (question.type === "MULTIPLE_CHOICE" && (!Array.isArray(question.correctAnswer) || question.correctAnswer.length === 0)) ||
                                          (question.type !== "MULTIPLE_CHOICE" && !question.correctAnswer?.toString()?.trim())) && (
                                            <Badge variant="destructive" className="text-xs">
                                                غير مكتمل
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
                                        <Label>نص السؤال</Label>
                                        <div className="flex items-center gap-2">
                                            {listeningQuestionId === question.id && (
                                                <span className="text-xs text-blue-600">
                                                    جاري الاستماع...
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
                                                    {listeningQuestionId === question.id ? "إيقاف التسجيل الصوتي" : "بدء التسجيل الصوتي"}
                                                </span>
                                            </Button>
                                        </div>
                                    </div>
                                    <Textarea
                                        value={question.text}
                                        onChange={(e) => updateQuestion(index, "text", e.target.value)}
                                        placeholder="أدخل نص السؤال"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>صورة السؤال (اختياري)</Label>
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
                                                            toast.success("تم رفع الصورة بنجاح");
                                                        }
                                                        setUploadingImages(prev => ({ ...prev, [index]: false }));
                                                    }}
                                                    onUploadError={(error: Error) => {
                                                        toast.error(`حدث خطأ أثناء رفع الصورة: ${error.message}`);
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
                                        <Label>نوع السؤال</Label>
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
                                                <SelectItem value="MULTIPLE_CHOICE">اختيار من متعدد</SelectItem>
                                                <SelectItem value="TRUE_FALSE">صح أو خطأ</SelectItem>
                                                <SelectItem value="SHORT_ANSWER">إجابة قصيرة</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>الدرجات</Label>
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
                                        <Label>الخيارات</Label>
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
                                                    placeholder={`الخيار ${optionIndex + 1}`}
                                                />
                                                <div className="flex items-center gap-1 shrink-0" title="إجابة صحيحة">
                                                    <Checkbox
                                                        id={`correct-${question.id}-${optionIndex}`}
                                                        checked={(Array.isArray(question.correctAnswer) ? question.correctAnswer : []).includes(optionIndex)}
                                                        onCheckedChange={() => toggleCorrectOption(index, optionIndex)}
                                                    />
                                                    <Label htmlFor={`correct-${question.id}-${optionIndex}`} className="text-xs cursor-pointer">صحيح</Label>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                                    onClick={() => removeOption(index, optionIndex)}
                                                    disabled={(question.options || ["", ""]).length <= 2}
                                                    title="حذف الخيار"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => addOption(index)}
                                            className="gap-1"
                                        >
                                            <Plus className="h-4 w-4" />
                                            إضافة خيار
                                        </Button>
                                    </div>
                                )}

                                {question.type === "TRUE_FALSE" && (
                                    <div className="space-y-2">
                                        <Label>الإجابة الصحيحة</Label>
                                        <Select
                                            value={typeof question.correctAnswer === 'string' ? question.correctAnswer : ''}
                                            onValueChange={(value) => updateQuestion(index, "correctAnswer", value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر الإجابة الصحيحة" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="true">صح</SelectItem>
                                                <SelectItem value="false">خطأ</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {question.type === "SHORT_ANSWER" && (
                                    <div className="space-y-2">
                                        <Label>الإجابة الصحيحة</Label>
                                        <Input
                                            value={typeof question.correctAnswer === 'string' ? question.correctAnswer : ''}
                                            onChange={(e) => updateQuestion(index, "correctAnswer", e.target.value)}
                                            placeholder="أدخل الإجابة الصحيحة"
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>شرح الإجابة الصحيحة (اختياري)</Label>
                                    <Textarea
                                        value={question.explanation ?? ""}
                                        onChange={(e) => updateQuestion(index, "explanation", e.target.value)}
                                        placeholder="أدخل شرحاً للإجابة الصحيحة يظهر للطالب عند عرض الإجابة"
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
                        إلغاء
                    </Button>
                    <Button
                        onClick={handleCreateQuiz}
                        disabled={isCreatingQuiz || questions.length === 0}
                    >
                        {isCreatingQuiz ? "جاري الحفظ..." : "إنشاء الاختبار"}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CreateQuizPage; 