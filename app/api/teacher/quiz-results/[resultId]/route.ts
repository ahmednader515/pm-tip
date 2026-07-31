import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ resultId: string }> }
) {
    try {
        const { userId, user } = await auth();
        const resolvedParams = await params;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const canManageAll = user?.role === "TEACHER" || user?.role === "ADMIN";

        const quizResult = await db.quizResult.findFirst({
            where: canManageAll
                ? { id: resolvedParams.resultId }
                : {
                    id: resolvedParams.resultId,
                    quiz: {
                        course: {
                            userId: userId
                        }
                    }
                },
            include: {
                user: {
                    select: {
                        fullName: true,
                        phoneNumber: true
                    }
                },
                quiz: {
                    select: {
                        title: true,
                        course: {
                            select: {
                                id: true,
                                title: true
                            }
                        }
                    }
                },
                answers: {
                    include: {
                        question: {
                            select: {
                                text: true,
                                type: true,
                                points: true,
                                options: true,
                                optionsEn: true,
                                correctAnswer: true,
                                position: true,
                                imageUrl: true,
                            }
                        }
                    },
                    orderBy: {
                        question: {
                            position: 'asc'
                        }
                    }
                }
            }
        });

        if (!quizResult) {
            return new NextResponse("Quiz result not found", { status: 404 });
        }

        return NextResponse.json(quizResult);
    } catch (error) {
        console.log("[TEACHER_QUIZ_RESULT_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
} 