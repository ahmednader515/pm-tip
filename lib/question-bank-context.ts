import { searchQuestions, type QuestionBankResult } from "@/lib/question-bank";

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

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
  return `أنت مساعد ذكي ودود لطلاب اختبارات PMP. تحدث بشكل طبيعي ومباشر مثل محادثة عادية في Gemini.

مهمتك:
- أجب على أسئلة الطالب بناءً على بيانات بنك الأسئلة المرفقة أدناه فقط.
- لا تخترع أسئلة أو إجابات أو شروحات غير موجودة في البيانات.
- إذا لم تجد معلومة في البيانات، قل ذلك بوضوح واقترح إعادة الصياغة.
- عند ذكر سؤال من البنك، اذكر نصه والخيارات والإجابة الصحيحة والشرح كما هي في البيانات.
- أجب بالعربية مع الإبقاء على المصطلحات الإنجليزية عند الحاجة (مثل PMBOK).
- استخدم سياق المحادثة السابقة للمتابعة والأسئلة التوضيحية.

=== بيانات بنك الأسئلة (المصدر الوحيد للإجابات) ===
${questionContext}
=== نهاية بيانات بنك الأسئلة ===`;
}
