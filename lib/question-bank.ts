import { db } from "@/lib/db";
import { parseCorrectAnswer, parseQuizOptions } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export type QuestionBankResult = {
  id: string;
  text: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  imageUrl: string | null;
  quizTitle: string;
  courseTitle: string;
};

const MAX_RESULTS = 15;
const MAX_ALL_QUESTIONS = 150;
const MIN_WORD_LENGTH = 2;

const publishedQuestionSelect = {
  id: true,
  text: true,
  type: true,
  options: true,
  correctAnswer: true,
  explanation: true,
  imageUrl: true,
  quiz: {
    select: {
      title: true,
      course: { select: { title: true } },
    },
  },
} as const;

const publishedQuestionFilter = {
  quiz: {
    isPublished: true,
    course: { isPublished: true },
  },
} satisfies Prisma.QuestionWhereInput;

function formatDisplayAnswer(
  type: string,
  correctAnswer: string | null
): string {
  if (type === "MULTIPLE_CHOICE") {
    const arr = parseCorrectAnswer(correctAnswer);
    return arr.join("، ");
  }
  if (type === "TRUE_FALSE") {
    return correctAnswer === "true" ? "صح" : "خطأ";
  }
  return correctAnswer ?? "";
}

function getSearchWords(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= MIN_WORD_LENGTH);
}

function buildKeywordConditions(words: string[]): Prisma.QuestionWhereInput[] {
  return words.flatMap((word) => [
    { text: { contains: word, mode: "insensitive" as const } },
    { explanation: { contains: word, mode: "insensitive" as const } },
    { options: { contains: word, mode: "insensitive" as const } },
    { correctAnswer: { contains: word, mode: "insensitive" as const } },
  ]);
}

export function mapQuestionToResult(question: {
  id: string;
  text: string;
  type: string;
  options: string | null;
  correctAnswer: string;
  explanation: string | null;
  imageUrl: string | null;
  quiz: { title: string; course: { title: string } };
}): QuestionBankResult {
  const type = question.type as QuestionBankResult["type"];
  let options: string[] = [];

  if (type === "MULTIPLE_CHOICE") {
    options = parseQuizOptions(question.options);
  } else if (type === "TRUE_FALSE") {
    options = ["صح", "خطأ"];
  }

  return {
    id: question.id,
    text: question.text,
    type,
    options,
    correctAnswer: formatDisplayAnswer(type, question.correctAnswer),
    explanation: question.explanation?.trim() || null,
    imageUrl: question.imageUrl,
    quizTitle: question.quiz.title,
    courseTitle: question.quiz.course.title,
  };
}

export async function searchQuestions(
  query: string
): Promise<{ results: QuestionBankResult[]; total: number }> {
  const words = getSearchWords(query);

  if (words.length === 0) {
    return { results: [], total: 0 };
  }

  const where: Prisma.QuestionWhereInput = {
    quiz: {
      isPublished: true,
      course: { isPublished: true },
    },
    OR: buildKeywordConditions(words),
  };

  const questions = await db.question.findMany({
    where,
    take: MAX_RESULTS,
    orderBy: [{ quiz: { course: { title: "asc" } } }, { position: "asc" }],
    select: {
      id: true,
      text: true,
      type: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      imageUrl: true,
      quiz: {
        select: {
          title: true,
          course: { select: { title: true } },
        },
      },
    },
  });

  return {
    results: questions.map(mapQuestionToResult),
    total: questions.length,
  };
}

export async function getAllPublishedQuestions(
  limit = MAX_ALL_QUESTIONS
): Promise<QuestionBankResult[]> {
  const questions = await db.question.findMany({
    where: publishedQuestionFilter,
    take: limit,
    orderBy: [{ quiz: { course: { title: "asc" } } }, { position: "asc" }],
    select: publishedQuestionSelect,
  });

  return questions.map(mapQuestionToResult);
}
