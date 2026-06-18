import { searchQuestions, type QuestionBankResult } from "@/lib/question-bank";
import type { ChatHistoryMessage } from "@/lib/gemini/multimodal";

export type { ChatHistoryMessage };

const MAX_CONTEXT_QUESTIONS = 12;

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
    return "لا توجد أسئلة مطابقة في بنك الأسئلة لهذا الموضوع حالياً.";
  }

  return questions
    .map((question, index) => formatQuestionForContext(question, index + 1))
    .join("\n\n---\n\n");
}

export async function fetchRelevantQuestionContext(
  message: string,
  history: ChatHistoryMessage[] = []
): Promise<string> {
  const query = buildContextSearchQuery(message, history);
  const { results } = await searchQuestions(query);
  return formatQuestionBankContext(results.slice(0, MAX_CONTEXT_QUESTIONS));
}

export function buildQuestionBankSystemInstruction(
  questionContext: string
): string {
  return `Use the following question bank as your reference when answering.
If the answer is not in this data, say you could not find it in the question bank.

${questionContext}`;
}
