import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: { quizId: string } }
) {
  try {
    const { userId, user } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { quizId } = params;

    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        courseId: true,
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      await tx.question.deleteMany({
        where: { quizId },
      });

      await tx.quiz.delete({
        where: { id: quizId },
      });

      const remainingQuizzes = await tx.quiz.findMany({
        where: { courseId: quiz.courseId },
        orderBy: { position: "asc" },
        select: { id: true, position: true },
      });

      await Promise.all(
        remainingQuizzes.map((remainingQuiz, index) =>
          remainingQuiz.position === index + 1
            ? Promise.resolve()
            : tx.quiz.update({
                where: { id: remainingQuiz.id },
                data: { position: index + 1 },
              })
        )
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN_QUIZ_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

