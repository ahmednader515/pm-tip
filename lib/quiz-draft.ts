export type RevealedFeedbackEntry = {
    correctAnswer: string;
    explanation?: string | null;
};

export type RevealedFeedback = Record<string, RevealedFeedbackEntry>;

export function normalizeRevealedFeedback(raw: unknown): RevealedFeedback {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return {};
    }

    const out: RevealedFeedback = {};
    for (const [questionId, value] of Object.entries(raw as Record<string, unknown>)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            continue;
        }
        const entry = value as Record<string, unknown>;
        if (typeof entry.correctAnswer !== "string") {
            continue;
        }
        out[questionId] = {
            correctAnswer: entry.correctAnswer,
            explanation:
                typeof entry.explanation === "string" ? entry.explanation : null,
        };
    }
    return out;
}

export function revealedFeedbackToState(feedback: RevealedFeedback): {
    correct: Record<string, string>;
    explanation: Record<string, string>;
} {
    const correct: Record<string, string> = {};
    const explanation: Record<string, string> = {};
    for (const [questionId, entry] of Object.entries(feedback)) {
        correct[questionId] = entry.correctAnswer;
        if (entry.explanation?.trim()) {
            explanation[questionId] = entry.explanation;
        }
    }
    return { correct, explanation };
}
