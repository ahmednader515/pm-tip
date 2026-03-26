import { db } from "@/lib/db";

export async function getCourseCertificateStatus(userId: string, courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      certificateEnabled: true,
      isPublished: true,
    },
  });

  if (!course) {
    return null;
  }

  const [totalChapters, totalQuizzes, completedChapters, quizResults] = await Promise.all([
    db.chapter.count({
      where: { courseId, isPublished: true },
    }),
    db.quiz.count({
      where: { courseId, isPublished: true },
    }),
    db.userProgress.count({
      where: {
        userId,
        isCompleted: true,
        chapter: {
          courseId,
          isPublished: true,
        },
      },
    }),
    db.quizResult.findMany({
      where: {
        studentId: userId,
        quiz: {
          courseId,
          isPublished: true,
        },
      },
      select: {
        quizId: true,
        submittedAt: true,
      },
      orderBy: {
        submittedAt: "desc",
      },
    }),
  ]);

  const completedQuizIds = new Set(quizResults.map((r) => r.quizId));
  const completedQuizzes = completedQuizIds.size;
  const totalContent = totalChapters + totalQuizzes;

  const eligible =
    Boolean(course.certificateEnabled) &&
    totalContent > 0 &&
    completedChapters >= totalChapters &&
    completedQuizzes >= totalQuizzes;

  return {
    courseId: course.id,
    courseTitle: course.title,
    certificateEnabled: course.certificateEnabled,
    totalChapters,
    completedChapters,
    totalQuizzes,
    completedQuizzes,
    totalContent,
    eligible,
    latestQuizSubmissionAt: quizResults[0]?.submittedAt?.toISOString() ?? null,
  };
}

