import { parseQuizOptions, stringifyQuizOptions } from "@/lib/utils";

export type MatchingOptions = {
  prompts: string[];
  answers: string[];
};

export type MatchingCorrectMap = Record<string, string>;

export const QUIZ_QUESTION_TYPES = [
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "DROPDOWN",
  "MATCHING",
] as const;

export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

export function isOptionListType(type: string): boolean {
  return type === "MULTIPLE_CHOICE" || type === "DROPDOWN";
}

export function parseMatchingOptions(
  value: string | MatchingOptions | null | undefined
): MatchingOptions {
  if (value == null) return { prompts: [], answers: [] };
  if (typeof value === "object" && !Array.isArray(value)) {
    return {
      prompts: Array.isArray(value.prompts)
        ? value.prompts.filter((p) => typeof p === "string" && p.trim())
        : [],
      answers: Array.isArray(value.answers)
        ? value.answers.filter((a) => typeof a === "string" && a.trim())
        : [],
    };
  }
  if (typeof value !== "string" || !value.trim()) {
    return { prompts: [], answers: [] };
  }
  try {
    const parsed = JSON.parse(value.trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parseMatchingOptions(parsed as MatchingOptions);
    }
  } catch {
    /* ignore */
  }
  return { prompts: [], answers: [] };
}

export function stringifyMatchingOptions(
  options: MatchingOptions | null | undefined
): string | null {
  if (!options) return null;
  const prompts = (options.prompts || [])
    .filter((p) => typeof p === "string" && p.trim())
    .map((p) => p.trim());
  const answers = (options.answers || [])
    .filter((a) => typeof a === "string" && a.trim())
    .map((a) => a.trim());
  if (prompts.length === 0 && answers.length === 0) return null;
  return JSON.stringify({ prompts, answers });
}

export function parseMatchingCorrect(
  value: string | MatchingCorrectMap | null | undefined
): MatchingCorrectMap {
  if (value == null) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    const out: MatchingCorrectMap = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof k === "string" && typeof v === "string" && k.trim() && v.trim()) {
        out[k.trim()] = v.trim();
      }
    }
    return out;
  }
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value.trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parseMatchingCorrect(parsed as MatchingCorrectMap);
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function stringifyMatchingCorrect(
  map: MatchingCorrectMap | null | undefined
): string {
  return JSON.stringify(parseMatchingCorrect(map));
}

/** Grade matching: +1 per correct pair. Returns points earned and whether fully correct. */
export function gradeMatchingAnswer(
  correctAnswer: string | null | undefined,
  studentAnswer: string | null | undefined
): { pointsEarned: number; maxPoints: number; isCorrect: boolean } {
  const correct = parseMatchingCorrect(correctAnswer);
  const prompts = Object.keys(correct);
  const maxPoints = prompts.length;
  let student: MatchingCorrectMap = {};
  if (typeof studentAnswer === "string" && studentAnswer.trim()) {
    student = parseMatchingCorrect(studentAnswer);
  }
  let pointsEarned = 0;
  for (const prompt of prompts) {
    if ((student[prompt] || "").trim() === correct[prompt].trim()) {
      pointsEarned += 1;
    }
  }
  return {
    pointsEarned,
    maxPoints,
    isCorrect: maxPoints > 0 && pointsEarned === maxPoints,
  };
}

/** Serialize options field for DB based on question type. */
export function serializeQuestionOptions(
  type: string,
  options: unknown,
  optionsEn?: unknown
): { options: string | null; optionsEn: string | null } {
  if (type === "MATCHING") {
    return {
      options: stringifyMatchingOptions(options as MatchingOptions),
      optionsEn:
        optionsEn == null
          ? null
          : stringifyMatchingOptions(
              typeof optionsEn === "string"
                ? parseMatchingOptions(optionsEn)
                : (optionsEn as MatchingOptions)
            ),
    };
  }
  if (isOptionListType(type)) {
    const list =
      Array.isArray(options)
        ? (options as string[])
        : typeof options === "string"
          ? parseQuizOptions(options)
          : [];
    const listEn =
      Array.isArray(optionsEn)
        ? (optionsEn as string[])
        : typeof optionsEn === "string"
          ? parseQuizOptions(optionsEn)
          : [];
    return {
      options: stringifyQuizOptions(list),
      optionsEn: listEn.length ? stringifyQuizOptions(listEn) : null,
    };
  }
  return { options: null, optionsEn: null };
}

/**
 * Build correctAnswer string for DB from UI payload.
 * MCQ/DROPDOWN: correctAnswer may be index array or option texts.
 */
export function serializeCorrectAnswer(
  type: string,
  correctAnswer: unknown,
  options: unknown
): string {
  if (type === "MATCHING") {
    return stringifyMatchingCorrect(correctAnswer as MatchingCorrectMap);
  }
  if (isOptionListType(type)) {
    const validOptions = (
      Array.isArray(options) ? options : parseQuizOptions(typeof options === "string" ? options : null)
    ).filter((o: string) => o && o.trim());

    if (Array.isArray(correctAnswer)) {
      const asNumbers = correctAnswer.every((x) => typeof x === "number");
      if (asNumbers) {
        const texts = (correctAnswer as number[])
          .map((i) => validOptions[i])
          .filter(Boolean);
        if (type === "DROPDOWN") {
          return texts[0] ?? validOptions[0] ?? "";
        }
        return texts.length ? JSON.stringify(texts) : validOptions[0] ?? "";
      }
      const texts = (correctAnswer as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((s) => s.trim());
      if (type === "DROPDOWN") return texts[0] ?? "";
      return texts.length ? JSON.stringify(texts) : "";
    }
    if (typeof correctAnswer === "number") {
      return validOptions[correctAnswer] ?? "";
    }
    return String(correctAnswer ?? "").trim();
  }
  return String(correctAnswer ?? "").trim();
}

export function matchingMaxPoints(options: string | MatchingOptions | null | undefined): number {
  return parseMatchingOptions(options).prompts.length;
}

/** Parse options for API/client based on question type. */
export function parseQuestionOptionsForClient(
  type: string,
  options: string | null | undefined
): string[] | MatchingOptions | null {
  if (type === "MATCHING") {
    return parseMatchingOptions(options);
  }
  if (isOptionListType(type)) {
    return parseQuizOptions(options ?? null);
  }
  return null;
}

export function buildQuestionCreateData(question: any, index: number, quizId?: string) {
  const type = String(question.type || "MULTIPLE_CHOICE");
  const { options, optionsEn } = serializeQuestionOptions(
    type,
    question.options,
    question.optionsEn
  );
  const correctAnswer = serializeCorrectAnswer(type, question.correctAnswer, question.options);
  let points = Number(question.points) || 1;
  if (type === "MATCHING") {
    points = Math.max(1, parseMatchingOptions(options).prompts.length);
  }
  return {
    text: question.text,
    textEn:
      question.textEn == null || String(question.textEn).trim() === ""
        ? null
        : String(question.textEn).trim(),
    type,
    options,
    optionsEn,
    correctAnswer,
    explanation: question.explanation?.trim() || null,
    explanationEn:
      question.explanationEn == null || String(question.explanationEn).trim() === ""
        ? null
        : String(question.explanationEn).trim(),
    points,
    imageUrl: question.imageUrl || null,
    position: index + 1,
    ...(quizId ? { quizId } : {}),
  };
}
