"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical, X, Mic } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useRouter, useParams, usePathname } from "next/navigation";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { UploadDropzone } from "@/lib/uploadthing";
import { parseCorrectAnswer } from "@/lib/utils";

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
    timer?: number;
    maxAttempts?: number;
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

const EditQuizPage = () => {
    const router = useRouter();
    const params = useParams();
    const quizId = params.quizId as string;
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
    const [certificateEnabled, setCertificateEnabled] = useState(false);
    const [certificatePassPercentage, setCertificatePassPercentage] = useState<number>(60);
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
                setQuizDescription(quiz.description);
                setQuizTimer(quiz.timer || null);
                setQuizMaxAttempts(quiz.maxAttempts || 1);
                setCertificateEnabled(Boolean((quiz as any).certificateEnabled));
                setCertificatePassPercentage(Number((quiz as any).certificatePassPercentage ?? 60));
                setSelectedCourse(quiz.courseId);
                
                // Convert stored correctAnswer (string or JSON array of option texts) to indices for multiple choice
                const processedQuestions = quiz.questions.map((question: { type: string; options?: string[]; correctAnswer: string }) => {
                    if (question.type === "MULTIPLE_CHOICE" && question.options) {
                        const validOptions = question.options.filter((o: string) => o.trim() !== "");
                        const correctTexts = parseCorrectAnswer(question.correctAnswer);
                        const indices = correctTexts
                            .map((t) => validOptions.indexOf(t))
                            .filter((i) => i >= 0);
                        return {
                            ...question,
                            correctAnswer: indices.length ? indices : [0]
                        };
                    }
                    return question;
                });
                
                setQuestions(processedQuestions);
                setSelectedPosition(quiz.position);
                await fetchCourseItems(quiz.courseId);
            } else {
                toast.error("حدث خطأ أثناء تحميل الاختبار");
                router.push(dashboardPath);
            }
        } catch (error) {
            console.error("Error fetching quiz:", error);
            toast.error("حدث خطأ أثناء تحميل الاختبار");
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

    const handleUpdateQuiz = async () => {
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

        setIsUpdatingQuiz(true);
        try {
            const response = await fetch(`/api/teacher/quizzes/${quizId}`, {
                method: "PATCH",
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
                    certificateEnabled,
                    certificatePassPercentage,
                }),
            });

            if (response.ok) {
                toast.success("تم تحديث الاختبار بنجاح");
                router.push(dashboardPath);
            } else {
                const error = await response.json();
                toast.error(error.message || "حدث خطأ أثناء تحديث الاختبار");
            }
        } catch (error) {
            console.error("Error updating quiz:", error);
            toast.error("حدث خطأ أثناء تحديث الاختبار");
        } finally {
            setIsUpdatingQuiz(false);
        }
    };

    const addQuestion = () => {
        const newQuestion: Question = {
            id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
                    toast.success("تم ترتيب الاختبار بنجاح");
                } else {
                    toast.error("حدث خطأ أثناء ترتيب الاختبار");
                }
            } catch (error) {
                console.error("Error reordering quiz:", error);
                toast.error("حدث خطأ أثناء ترتيب الاختبار");
            }
        }
        // For other items, we don't want to reorder them, so we ignore the drag
        // The drag and drop library will handle the visual feedback, but we don't update state
    };

    if (isLoadingQuiz) {
        return (
            <div className="p-6">
                <div className="text-center">جاري التحميل...</div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    تعديل الاختبار
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
                            // Don't reset position when changing course - keep the quiz's current position
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
                            onChange={(e) => setQuizTitle(e.target.value)}
                            placeholder="أدخل عنوان الاختبار"
                        />
                    </div>
                </div>

                {selectedCourse && (
                    <Card>
                        <CardHeader>
                            <CardTitle>ترتيب الاختبار في الكورس</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                اسحب الاختبار إلى الموقع المطلوب بين الفصول والاختبارات الموجودة
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
                                                                            {item.type === "chapter" ? "فصل" : "اختبار"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <Badge variant={item.id === quizId ? "outline" : (item.isPublished ? "default" : "secondary")} className={item.id === quizId ? "border-blue-300 text-blue-700" : ""}>
                                                                    {item.id === quizId ? "قيد التعديل" : (item.isPublished ? "منشور" : "مسودة")}
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
                                                قيد التعديل
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
                        <CardTitle>الشهادة</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="space-y-1">
                                <Label>إصدار شهادة بعد النجاح</Label>
                                <p className="text-sm text-muted-foreground">
                                    عند تفعيلها سيظهر للطالب زر تحميل الشهادة بعد إنهاء الاختبار وتحقيق نسبة النجاح.
                                </p>
                            </div>
                            <Checkbox
                                checked={certificateEnabled}
                                onCheckedChange={(v) => setCertificateEnabled(Boolean(v))}
                                aria-label="Enable certificate"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>نسبة النجاح للحصول على الشهادة</Label>
                            <Input
                                type="number"
                                value={certificatePassPercentage}
                                onChange={(e) => setCertificatePassPercentage(Math.min(100, Math.max(0, parseInt(e.target.value || "0"))))}
                                min="0"
                                max="100"
                                disabled={!certificateEnabled}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            سيتم استخدام القالب `public/certificate.png` وسيتم كتابة اسم الطالب عليه تلقائياً.
                        </p>
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
                                             (!question.options || question.options.filter(opt => opt.trim() !== "").length === 0)) ||
                                            (question.type === "MULTIPLE_CHOICE" && (!Array.isArray(question.correctAnswer) || question.correctAnswer.length === 0)) ||
                                            (question.type === "TRUE_FALSE" &&
                                             (typeof question.correctAnswer !== 'string' || (question.correctAnswer !== "true" && question.correctAnswer !== "false"))) ||
                                            (question.type === "SHORT_ANSWER" &&
                                             (typeof question.correctAnswer !== 'string' || question.correctAnswer.trim() === ""))) && (
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
                        onClick={handleUpdateQuiz}
                        disabled={isUpdatingQuiz || questions.length === 0}
                    >
                        {isUpdatingQuiz ? "جاري التحديث..." : "تحديث الاختبار"}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EditQuizPage; 