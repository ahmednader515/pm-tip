import { cache } from "react";
import {
  getAllPublishedQuestions,
  searchQuestions,
  type QuestionBankResult,
} from "@/lib/question-bank";
import type { ChatHistoryMessage } from "@/lib/chat/multimodal";

export type { ChatHistoryMessage };

const MAX_CONTEXT_QUESTIONS = 150;

export function buildContextSearchQuery(
  message: string,
  history: ChatHistoryMessage[] = []
): string {
  const recentUserMessages = history
    .filter((item) => item.role === "user")
    .slice(-2)
    .map((item) => item.content);

  return [...recentUserMessages, message].join(" ").trim();
}

function formatQuestionForContext(
  question: QuestionBankResult,
  index: number
): string {
  const lines = [
    `[${index}] الكورس: ${question.courseTitle} | الاختبار: ${question.quizTitle}`,
    `السؤال: ${question.text}`,
  ];

  if (question.options.length > 0) {
    lines.push(
      `الخيارات: ${question.options.map((option, i) => `${i + 1}) ${option}`).join(" | ")}`
    );
  }

  lines.push(`الإجابة الصحيحة: ${question.correctAnswer}`);

  if (question.explanation) {
    lines.push(`الشرح: ${question.explanation}`);
  }

  return lines.join("\n");
}

export function formatQuestionBankContext(
  questions: QuestionBankResult[]
): string {
  if (questions.length === 0) {
    return "No published questions are available in the question bank.";
  }

  return questions
    .map((question, index) => formatQuestionForContext(question, index + 1))
    .join("\n\n---\n\n");
}

export const getCachedPublishedQuestions = cache(async () =>
  getAllPublishedQuestions(MAX_CONTEXT_QUESTIONS)
);

function rankQuestionsForQuery(
  questions: QuestionBankResult[],
  query: string
): QuestionBankResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return questions;

  const words = normalizedQuery
    .split(/\s+/)
    .filter((word) => word.length >= 2);

  if (words.length === 0) return questions;

  const scored = questions.map((question) => {
    const haystack = [
      question.text,
      question.explanation ?? "",
      question.correctAnswer,
      question.options.join(" "),
      question.quizTitle,
      question.courseTitle,
    ]
      .join(" ")
      .toLowerCase();

    let score = 0;
    for (const word of words) {
      if (haystack.includes(word)) score += 1;
    }

    return { question, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const matched = scored.filter((item) => item.score > 0).map((item) => item.question);
  const unmatched = scored
    .filter((item) => item.score === 0)
    .map((item) => item.question);

  return [...matched, ...unmatched].slice(0, MAX_CONTEXT_QUESTIONS);
}

export async function fetchQuestionBankContext(
  message: string,
  history: ChatHistoryMessage[] = []
): Promise<string> {
  const query = buildContextSearchQuery(message, history);
  const allQuestions = await getCachedPublishedQuestions();

  if (allQuestions.length === 0) {
    return "No published questions are available in the question bank.";
  }

  const ranked = rankQuestionsForQuery(allQuestions, query);

  // Also pull direct DB matches that may not be in the cached slice
  const { results: searchMatches } = await searchQuestions(query);
  const merged = mergeQuestions(searchMatches, ranked).slice(0, MAX_CONTEXT_QUESTIONS);

  return formatQuestionBankContext(merged);
}

function mergeQuestions(
  primary: QuestionBankResult[],
  secondary: QuestionBankResult[]
): QuestionBankResult[] {
  const seen = new Set<string>();
  const merged: QuestionBankResult[] = [];

  for (const question of [...primary, ...secondary]) {
    if (seen.has(question.id)) continue;
    seen.add(question.id);
    merged.push(question);
  }

  return merged;
}

/** @deprecated Use fetchQuestionBankContext */
export const fetchRelevantQuestionContext = fetchQuestionBankContext;

export function buildQuestionBankSystemInstruction(
  questionContext: string
): string {
  return `You are a helpful assistant. Answer naturally like ChatGPT.

IMPORTANT: The ONLY source of quiz/exam knowledge you may use is the question bank below.
Each entry includes the question text, choices (if any), the correct answer, and the explanation.
Do not invent questions, answers, or explanations that are not in this data.
If the user asks about something not covered here, say you could not find it in the question bank.

=== QUESTION BANK ===
${questionContext}
=== END QUESTION BANK ===`;
}
