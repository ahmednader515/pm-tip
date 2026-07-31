"use client";

import { useCallback, useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MatchingOptions } from "@/lib/quiz-question";
import type { Locale } from "@/i18n/config";

type Props = {
  prompts: string[];
  answers: string[];
  promptsDisplay?: string[];
  answersDisplay?: string[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
};

type Point = { x: number; y: number };
type Line = { from: Point; to: Point; key: string };

const LINE_COLOR = "var(--brand, var(--primary))";

export function MatchingQuestion({
  prompts,
  answers,
  promptsDisplay,
  answersDisplay,
  value,
  onChange,
  disabled,
}: Props) {
  const t = useTranslations("quiz");
  const locale = useLocale() as Locale;
  const isRtl = locale === "ar";
  const markerId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const promptRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const answerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);

  const displayPrompts = promptsDisplay?.length === prompts.length ? promptsDisplay : prompts;
  const displayAnswers = answersDisplay?.length === answers.length ? answersDisplay : answers;

  const recomputeLines = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const next: Line[] = [];

    for (const [prompt, answer] of Object.entries(value)) {
      const pIndex = prompts.indexOf(prompt);
      const aIndex = answers.indexOf(answer);
      if (pIndex < 0 || aIndex < 0) continue;
      const pEl = promptRefs.current[pIndex];
      const aEl = answerRefs.current[aIndex];
      if (!pEl || !aEl) continue;

      const pRect = pEl.getBoundingClientRect();
      const aRect = aEl.getBoundingClientRect();

      // Link answer → question (arrow points at the question)
      const fromX = isRtl ? aRect.right - cRect.left : aRect.left - cRect.left;
      const toX = isRtl ? pRect.left - cRect.left : pRect.right - cRect.left;

      next.push({
        key: `${answer}=>${prompt}`,
        from: { x: fromX, y: aRect.top + aRect.height / 2 - cRect.top },
        to: { x: toX, y: pRect.top + pRect.height / 2 - cRect.top },
      });
    }

    setLines(next);
  }, [value, isRtl, prompts, answers]);

  useLayoutEffect(() => {
    recomputeLines();
    const id = requestAnimationFrame(() => recomputeLines());
    return () => cancelAnimationFrame(id);
  }, [recomputeLines, displayPrompts, displayAnswers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => recomputeLines());
    ro.observe(container);
    window.addEventListener("scroll", recomputeLines, true);
    window.addEventListener("resize", recomputeLines);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", recomputeLines, true);
      window.removeEventListener("resize", recomputeLines);
    };
  }, [recomputeLines]);

  const pairedAnswers = new Set(Object.values(value));
  const pairedPrompts = new Set(Object.keys(value));

  const clearPairForPrompt = (prompt: string) => {
    const next = { ...value };
    delete next[prompt];
    onChange(next);
  };

  const clearPairForAnswer = (answer: string) => {
    const next = { ...value };
    for (const [p, a] of Object.entries(next)) {
      if (a === answer) delete next[p];
    }
    onChange(next);
  };

  const tryPair = (prompt: string | null, answer: string | null) => {
    if (!prompt || !answer || disabled) return;
    const next = { ...value };
    for (const [p, a] of Object.entries(next)) {
      if (a === answer || p === prompt) delete next[p];
    }
    next[prompt] = answer;
    onChange(next);
    setSelectedPrompt(null);
    setSelectedAnswer(null);
  };

  const onPromptClick = (prompt: string) => {
    if (disabled) return;
    if (pairedPrompts.has(prompt)) {
      clearPairForPrompt(prompt);
      setSelectedPrompt(null);
      setSelectedAnswer(null);
      return;
    }
    if (selectedAnswer) {
      tryPair(prompt, selectedAnswer);
      return;
    }
    setSelectedPrompt((prev) => (prev === prompt ? null : prompt));
  };

  const onAnswerClick = (answer: string) => {
    if (disabled) return;
    if (pairedAnswers.has(answer)) {
      clearPairForAnswer(answer);
      setSelectedPrompt(null);
      setSelectedAnswer(null);
      return;
    }
    if (selectedPrompt) {
      tryPair(selectedPrompt, answer);
      return;
    }
    setSelectedAnswer((prev) => (prev === answer ? null : answer));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("matchingHint")}</p>
      <div
        ref={containerRef}
        className="relative grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-16 items-start"
      >
        {/* Connection lines: question edge → answer edge */}
        <svg
          className="pointer-events-none absolute inset-0 z-30 hidden h-full w-full overflow-visible md:block"
          aria-hidden
        >
          <defs>
            <marker
              id={`matching-arrow-${markerId}`}
              viewBox="0 0 12 12"
              refX="11"
              refY="6"
              markerWidth="9"
              markerHeight="9"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,1 L11,6 L0,11 Z" fill={LINE_COLOR} />
            </marker>
          </defs>
          {lines.map((line) => {
            const midX = (line.from.x + line.to.x) / 2;
            const d = `M ${line.from.x} ${line.from.y} C ${midX} ${line.from.y}, ${midX} ${line.to.y}, ${line.to.x} ${line.to.y}`;
            return (
              <g key={line.key}>
                <circle cx={line.from.x} cy={line.from.y} r={4} fill={LINE_COLOR} />
                <path
                  d={d}
                  fill="none"
                  stroke={LINE_COLOR}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  markerEnd={`url(#matching-arrow-${markerId})`}
                />
              </g>
            );
          })}
        </svg>

        <div className="relative z-20 space-y-2">
          <h4 className="mb-2 text-sm font-semibold">{t("matchingPrompts")}</h4>
          {prompts.map((prompt, i) => {
            const paired = pairedPrompts.has(prompt);
            const selected = selectedPrompt === prompt;
            return (
              <button
                key={`p-${i}-${prompt}`}
                type="button"
                ref={(el) => {
                  promptRefs.current[i] = el;
                }}
                disabled={disabled || !prompt.trim()}
                onClick={() => onPromptClick(prompt)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-start text-sm transition-colors auto-dir",
                  paired && "border-primary bg-primary/10",
                  selected && "border-primary ring-2 ring-primary",
                  !paired && !selected && "hover:bg-muted/50"
                )}
              >
                <span className="font-medium">{displayPrompts[i] || prompt}</span>
                {paired && (
                  <span className="mt-1 block text-xs text-primary md:hidden">
                    → {displayAnswers[answers.indexOf(value[prompt])] || value[prompt]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative z-20 space-y-2">
          <h4 className="mb-2 text-sm font-semibold">{t("matchingAnswers")}</h4>
          {answers.map((answer, i) => {
            const paired = pairedAnswers.has(answer);
            const selected = selectedAnswer === answer;
            return (
              <button
                key={`a-${i}-${answer}`}
                type="button"
                ref={(el) => {
                  answerRefs.current[i] = el;
                }}
                disabled={disabled || !answer.trim()}
                onClick={() => onAnswerClick(answer)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-start text-sm transition-colors auto-dir",
                  paired && "border-primary bg-primary/10",
                  selected && "border-primary ring-2 ring-primary",
                  !paired && !selected && "hover:bg-muted/50"
                )}
              >
                {displayAnswers[i] || answer}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Build display lists from bilingual matching options. */
export function getMatchingDisplay(
  options: MatchingOptions,
  optionsEn: MatchingOptions | null | undefined,
  locale: Locale
): { prompts: string[]; answers: string[]; promptsDisplay: string[]; answersDisplay: string[] } {
  const prompts = options.prompts;
  const answers = options.answers;
  if (locale === "en" && optionsEn) {
    return {
      prompts,
      answers,
      promptsDisplay: prompts.map((p, i) => optionsEn.prompts[i]?.trim() || p),
      answersDisplay: answers.map((a, i) => optionsEn.answers[i]?.trim() || a),
    };
  }
  return { prompts, answers, promptsDisplay: prompts, answersDisplay: answers };
}
