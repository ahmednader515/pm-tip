import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { parseQuizOptions, parseCorrectAnswer } from "@/lib/utils";
import { hasCourseAccess } from "@/lib/course-access";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
    try {
        const { userId } = await auth();
        const resolvedParams = await params;
        const { answers } = await req.json();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const access = await hasCourseAccess(userId, resolvedParams.courseId);
        if (!access) {
            return new NextResponse("Course access required", { status: 403 });
        }

        // Get the quiz with questions
        const quiz = await db.quiz.findFirst({
            where: {
                id: resolvedParams.quizId,
                courseId: resolvedParams.courseId,
                isPublished: true
            },
            include: {
                questions: {
                    select: {
                        id: true,
                        text: true,
                        type: true,
                        options: true,
                        correctAnswer: true,
                        points: true,
                        imageUrl: true
                    },
                    orderBy: {
                        position: 'asc'
                    }
                }
            }
        });

        if (!quiz) {
            return new NextResponse("Quiz not found", { status: 404 });
        }

        // Check if user has already taken this quiz and if they can take it again
        const existingResults = await db.quizResult.findMany({
            where: {
                studentId: userId,
                quizId: resolvedParams.quizId
            },
            orderBy: {
                attemptNumber: 'desc'
            }
        });

        const currentAttemptNumber = existingResults.length + 1;

        if (existingResults.length >= quiz.maxAttempts) {
            return new NextResponse("Maximum attempts reached for this quiz", { status: 400 });
        }

        // Calculate score
        let totalScore = 0;
        let totalPoints = 0;
        const quizAnswers = [];

        for (const question of quiz.questions) {
            totalPoints += question.points;
            const studentAnswer = answers.find((a: any) => a.questionId === question.id)?.answer || "";
            
            let isCorrect = false;
            let pointsEarned = 0;

            if (question.type === "MULTIPLE_CHOICE") {
                const correctOptionTexts = parseCorrectAnswer(question.correctAnswer);
                let studentSelected: string[] = [];
                try {
                    const parsed = JSON.parse(studentAnswer);
                    if (Array.isArray(parsed)) {
                        studentSelected = parsed.filter((x: unknown) => typeof x === "string").map((s: string) => s.trim());
                    } else {
                        studentSelected = studentAnswer.trim() ? [studentAnswer.trim()] : [];
                    }
                } catch {
                    studentSelected = studentAnswer.trim() ? [studentAnswer.trim()] : [];
                }
                const correctSet = new Set(correctOptionTexts.map((t) => t.trim()));
                const studentSet = new Set(studentSelected);
                isCorrect = correctSet.size === studentSet.size && [...correctSet].every((t) => studentSet.has(t));
            } else if (question.type === "TRUE_FALSE") {
                isCorrect = studentAnswer.toLowerCase() === question.correctAnswer.toLowerCase();
            } else if (question.type === "SHORT_ANSWER") {
                // For short answer, do a case-insensitive comparison
                isCorrect = studentAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
            }

            if (isCorrect) {
                pointsEarned = question.points;
                totalScore += question.points;
            }

            quizAnswers.push({
                questionId: question.id,
                studentAnswer, // already string (single or JSON array)
                correctAnswer: question.correctAnswer, // stored as-is (single or JSON array)
                isCorrect,
                pointsEarned
            });
        }

        const percentage = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;

        // Clear any saved draft for this user/quiz
        await db.quizDraft.deleteMany({
            where: {
                userId,
                quizId: resolvedParams.quizId,
            },
        });

        // Create quiz result
        const quizResult = await db.quizResult.create({
            data: {
                studentId: userId,
                quizId: resolvedParams.quizId,
                score: totalScore,
                totalPoints,
                percentage,
                attemptNumber: currentAttemptNumber,
                answers: {
                    create: quizAnswers
                }
            },
            include: {
                answers: {
                    include: {
                        question: true
                    }
                }
            }
        });

        return NextResponse.json({
            ...quizResult,
            answers: quizResult.answers.map(answer => ({
                ...answer,
                question: {
                    ...answer.question,
                    options: parseQuizOptions(answer.question.options)
                }
            }))
        });
    } catch (error) {
        console.log("[QUIZ_SUBMIT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
} 