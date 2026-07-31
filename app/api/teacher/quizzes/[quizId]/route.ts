import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
    buildQuestionCreateData,
    isOptionListType,
    parseMatchingCorrect,
    parseMatchingOptions,
    parseQuestionOptionsForClient,
} from "@/lib/quiz-question";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ quizId: string }> }
) {
    try {
        const { userId, user } = await auth();
        const resolvedParams = await params;

        console.log("[TEACHER_QUIZ_GET] Fetching quiz:", resolvedParams.quizId, "for user:", userId);

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const canManageAll = user?.role === "TEACHER" || user?.role === "ADMIN";

        const quiz = await db.quiz.findFirst({
            where: canManageAll
                ? { id: resolvedParams.quizId }
                : {
                    id: resolvedParams.quizId,
                    course: {
                        userId: userId,
                    },
                },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true
                    }
                },
                questions: {
                    select: {
                        id: true,
                        text: true,
                        textEn: true,
                        type: true,
                        options: true,
                        optionsEn: true,
                        correctAnswer: true,
                        explanation: true,
                        explanationEn: true,
                        points: true,
                        imageUrl: true,
                        position: true
                    },
                    orderBy: {
                        position: 'asc'
                    }
                }
            }
        });

        if (!quiz) {
            console.log("[TEACHER_QUIZ_GET] Quiz not found for ID:", resolvedParams.quizId);
            return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
        }

        console.log("[TEACHER_QUIZ_GET] Quiz found:", quiz.id, "with", quiz.questions.length, "questions");

        const quizWithParsedOptions = {
            ...quiz,
            questions: quiz.questions.map(question => ({
                ...question,
                options: parseQuestionOptionsForClient(question.type, question.options),
                optionsEn: parseQuestionOptionsForClient(question.type, question.optionsEn),
            })),
        };

        return NextResponse.json(quizWithParsedOptions);
    } catch (error) {
        console.log("[TEACHER_QUIZ_GET] Error details:", error);
        console.log("[TEACHER_QUIZ_GET] Error stack:", (error as Error).stack);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ quizId: string }> }
) {
    try {
        const { userId, user } = await auth();
        const resolvedParams = await params;
        const { title, titleEn, description, descriptionEn, questions, position, timer, maxAttempts, courseId, certificateEnabled, certificatePassPercentage } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (user?.role !== "TEACHER" && user?.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const currentQuiz = await db.quiz.findUnique({
            where: { id: resolvedParams.quizId },
            select: { courseId: true, position: true }
        });

        if (!currentQuiz) {
            return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
        }

        // Use the courseId from request if provided, otherwise use current quiz's courseId
        const targetCourseId = courseId || currentQuiz.courseId;

        // Validate required fields
        if (!title || !title.trim()) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        // Handle position - use current position if not provided or invalid
        let quizPosition = position;
        if (!quizPosition || quizPosition <= 0) {
            quizPosition = currentQuiz.position;
        }

        // Validate questions
        if (!questions || questions.length === 0) {
            return NextResponse.json({ error: "At least one question is required" }, { status: 400 });
        }

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            if (!question.text || !question.text.trim()) {
                return NextResponse.json({ error: `Question ${i + 1}: Text is required` }, { status: 400 });
            }

            if (question.type === "MULTIPLE_CHOICE") {
                if (!question.options || question.options.length < 2) {
                    return NextResponse.json({ error: `Question ${i + 1}: At least 2 options are required` }, { status: 400 });
                }

                const validOptions = question.options.filter((option: string) => option && option.trim() !== "");
                if (validOptions.length < 2) {
                    return NextResponse.json({ error: `Question ${i + 1}: At least 2 valid options are required` }, { status: 400 });
                }

                const indices = Array.isArray(question.correctAnswer)
                    ? question.correctAnswer
                    : typeof question.correctAnswer === "number"
                    ? [question.correctAnswer]
                    : [];
                if (indices.length === 0 || indices.some((idx: number) => typeof idx !== "number" || idx < 0 || idx >= validOptions.length)) {
                    return NextResponse.json({ error: `Question ${i + 1}: At least one valid correct answer index is required` }, { status: 400 });
                }
            } else if (question.type === "TRUE_FALSE") {
                if (!question.correctAnswer || (question.correctAnswer !== "true" && question.correctAnswer !== "false")) {
                    return NextResponse.json({ error: `Question ${i + 1}: Correct answer must be "true" or "false"` }, { status: 400 });
                }
            } else if (question.type === "SHORT_ANSWER") {
                if (!question.correctAnswer || !question.correctAnswer.toString().trim()) {
                    return NextResponse.json({ error: `Question ${i + 1}: Correct answer is required` }, { status: 400 });
                }
            }

            if (!question.points || question.points <= 0) {
                return NextResponse.json({ error: `Question ${i + 1}: Points must be greater than 0` }, { status: 400 });
            }
        }

        // Note: Position reordering is now handled by the separate reorder API
        // This API just updates the quiz with the provided position

        // Update the quiz without questions first
        const updatedQuiz = await db.quiz.update({
            where: {
                id: resolvedParams.quizId
            },
            data: {
                title,
                ...(titleEn !== undefined && {
                    titleEn:
                        titleEn == null || String(titleEn).trim() === ""
                            ? null
                            : String(titleEn).trim(),
                }),
                description,
                ...(descriptionEn !== undefined && {
                    descriptionEn:
                        descriptionEn == null || String(descriptionEn).trim() === ""
                            ? null
                            : String(descriptionEn).trim(),
                }),
                courseId: targetCourseId, // Update courseId if changed
                position: Number(quizPosition), // Explicitly cast to number
                timer: timer || null,
                maxAttempts: maxAttempts || 1,
                certificateEnabled: Boolean(certificateEnabled),
                certificatePassPercentage: Math.min(100, Math.max(0, Number(certificatePassPercentage ?? 75))),
            },
            include: {
                course: {
                    select: {
                        title: true
                    }
                }
            }
        });

        // Delete existing questions
        await db.question.deleteMany({
            where: {
                quizId: resolvedParams.quizId
            }
        });

        if (questions.length > 0) {
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                if (isOptionListType(question.type)) {
                    const validOptions = (question.options || []).filter((option: string) => option && option.trim() !== "");
                    if (validOptions.length < 2) {
                        return NextResponse.json({ error: `Question ${i + 1}: At least 2 valid options are required` }, { status: 400 });
                    }
                    const indices = Array.isArray(question.correctAnswer)
                        ? question.correctAnswer
                        : typeof question.correctAnswer === "number"
                        ? [question.correctAnswer]
                        : [];
                    if (indices.length === 0) {
                        return NextResponse.json({ error: `Question ${i + 1}: Correct answer is required` }, { status: 400 });
                    }
                    if (question.type === "DROPDOWN" && indices.length !== 1) {
                        return NextResponse.json({ error: `Question ${i + 1}: Dropdown requires exactly one correct answer` }, { status: 400 });
                    }
                } else if (question.type === "MATCHING") {
                    const matching = parseMatchingOptions(question.options);
                    if (matching.prompts.length < 2 || matching.answers.length < matching.prompts.length) {
                        return NextResponse.json({ error: `Question ${i + 1}: Invalid matching options` }, { status: 400 });
                    }
                    const correct = parseMatchingCorrect(question.correctAnswer);
                    const used = new Set<string>();
                    for (const prompt of matching.prompts) {
                        const ans = correct[prompt];
                        if (!ans || !matching.answers.includes(ans) || used.has(ans)) {
                            return NextResponse.json({ error: `Question ${i + 1}: Each prompt needs a unique correct answer` }, { status: 400 });
                        }
                        used.add(ans);
                    }
                }
            }
            await db.question.createMany({
                data: questions.map((question: any, index: number) =>
                    buildQuestionCreateData(question, index, resolvedParams.quizId)
                ),
            });
        }

        // Fetch the updated quiz with questions
        const quizWithQuestions = await db.quiz.findUnique({
            where: { id: resolvedParams.quizId },
            include: {
                course: {
                    select: {
                        title: true
                    }
                },
                questions: {
                    orderBy: {
                        position: 'asc'
                    }
                }
            }
        });

        if (!quizWithQuestions) {
            return NextResponse.json({ error: "Failed to update quiz" }, { status: 500 });
        }

        const quizWithParsedOptions = {
            ...quizWithQuestions,
            questions: quizWithQuestions.questions.map(question => ({
                ...question,
                options: parseQuestionOptionsForClient(question.type, question.options),
                optionsEn: parseQuestionOptionsForClient(question.type, question.optionsEn),
            }))
        };

        return NextResponse.json(quizWithParsedOptions);
    } catch (error) {
        console.log("[QUIZ_PATCH]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
} 