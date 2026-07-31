import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { parseQuizOptions } from "@/lib/utils";
import {
    buildQuestionCreateData,
    isOptionListType,
    parseMatchingCorrect,
    parseMatchingOptions,
    parseQuestionOptionsForClient,
} from "@/lib/quiz-question";

export async function GET(req: Request) {
    try {
        const { userId, user } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const canManageAll = user?.role === "TEACHER" || user?.role === "ADMIN";

        const quizzes = await db.quiz.findMany({
            where: canManageAll
                ? undefined
                : {
                    course: {
                        userId: userId
                    }
                },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        titleEn: true
                    }
                },
                questions: {
                    select: {
                        id: true,
                        text: true,
                        type: true,
                        options: true,
                        correctAnswer: true,
                        points: true,
                        imageUrl: true,
                        position: true
                    },
                    orderBy: {
                        position: 'asc'
                    }
                }
            },
            orderBy: {
                position: "asc"
            }
        });

        const quizzesWithParsedOptions = quizzes.map(quiz => ({
            ...quiz,
            questions: quiz.questions.map(question => ({
                ...question,
                options: parseQuestionOptionsForClient(question.type, question.options),
            }))
        }));

        return NextResponse.json(quizzesWithParsedOptions);
    } catch (error) {
        console.log("[TEACHER_QUIZZES_GET]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { userId, user } = await auth();
        const { title, titleEn, description, descriptionEn, courseId, questions, position, timer, maxAttempts, certificateEnabled, certificatePassPercentage } = await req.json();

        console.log("Received position:", position, "Type:", typeof position);

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (user?.role !== "TEACHER" && user?.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Validate required fields
        if (!title || !title.trim()) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        if (!courseId) {
            return NextResponse.json({ error: "Course ID is required" }, { status: 400 });
        }

        const course = await db.course.findUnique({
            where: {
                id: courseId,
            },
            select: {
                id: true,
            },
        });

        if (!course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        // Get the next position if not provided
        let quizPosition = position;
        console.log("Initial quizPosition:", quizPosition);
        if (!quizPosition || quizPosition <= 0) {
            const lastQuiz = await db.quiz.findFirst({
                where: {
                    courseId: courseId
                },
                orderBy: {
                    position: 'desc'
                }
            });
            quizPosition = lastQuiz ? lastQuiz.position + 1 : 1;
            console.log("Calculated quizPosition:", quizPosition, "Last quiz position:", lastQuiz?.position);
        }
        console.log("Final quizPosition:", quizPosition);

        // Validate questions
        if (!questions || questions.length === 0) {
            return NextResponse.json({ error: "At least one question is required" }, { status: 400 });
        }

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            
            if (!question.text || !question.text.trim()) {
                return NextResponse.json({ error: `Question ${i + 1}: Text is required` }, { status: 400 });
            }

            if (isOptionListType(question.type)) {
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
                if (question.type === "DROPDOWN" && indices.length !== 1) {
                    return NextResponse.json({ error: `Question ${i + 1}: Dropdown requires exactly one correct answer` }, { status: 400 });
                }
            } else if (question.type === "MATCHING") {
                const matching = parseMatchingOptions(question.options);
                if (matching.prompts.length < 2) {
                    return NextResponse.json({ error: `Question ${i + 1}: Matching requires at least 2 prompts` }, { status: 400 });
                }
                if (matching.answers.length < matching.prompts.length) {
                    return NextResponse.json({ error: `Question ${i + 1}: Matching needs at least as many answers as prompts` }, { status: 400 });
                }
                const correct = parseMatchingCorrect(question.correctAnswer);
                const usedAnswers = new Set<string>();
                for (const prompt of matching.prompts) {
                    const ans = correct[prompt];
                    if (!ans || !matching.answers.includes(ans)) {
                        return NextResponse.json({ error: `Question ${i + 1}: Each prompt needs a unique correct answer` }, { status: 400 });
                    }
                    if (usedAnswers.has(ans)) {
                        return NextResponse.json({ error: `Question ${i + 1}: Correct answers must be unique across prompts` }, { status: 400 });
                    }
                    usedAnswers.add(ans);
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

            if (question.type !== "MATCHING" && (!question.points || question.points <= 0)) {
                return NextResponse.json({ error: `Question ${i + 1}: Points must be greater than 0` }, { status: 400 });
            }
        }

        // Create the quiz
        console.log("Creating quiz with position:", quizPosition);
        console.log("Quiz data object:", {
            title,
            description,
            position: quizPosition,
            courseId,
            timer: timer || null,
            maxAttempts: maxAttempts || 1
        });
        
        const quizData = {
            title,
            description,
            position: Number(quizPosition), // Explicitly cast to number
            courseId,
            timer: timer || null, // Timer in minutes, null means no time limit
            maxAttempts: maxAttempts || 1, // Default to 1 attempt if not specified
        };
        
        console.log("Final quiz data:", JSON.stringify(quizData, null, 2));
        
        // Try creating the quiz without questions first
        const quizDataWithoutQuestions = {
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
            position: Number(quizPosition),
            courseId,
            timer: timer || null,
            maxAttempts: maxAttempts || 1,
            certificateEnabled: Boolean(certificateEnabled),
            certificatePassPercentage: Math.min(100, Math.max(0, Number(certificatePassPercentage ?? 75))),
        };
        
        console.log("Quiz data without questions:", JSON.stringify(quizDataWithoutQuestions, null, 2));
        
        const quiz = await db.quiz.create({
            data: quizDataWithoutQuestions,
            include: {
                course: {
                    select: {
                        title: true
                    }
                }
            }
        });
        
        // Now add the questions separately
        if (questions.length > 0) {
            await db.question.createMany({
                data: questions.map((question: any, index: number) =>
                    buildQuestionCreateData(question, index, quiz.id)
                ),
            });
        }
        
        // Fetch the quiz with questions
        const quizWithQuestions = await db.quiz.findUnique({
            where: { id: quiz.id },
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
            return NextResponse.json({ error: "Failed to create quiz" }, { status: 500 });
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
        console.log("[TEACHER_QUIZZES_POST]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
} 