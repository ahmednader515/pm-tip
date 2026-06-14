"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import type { QuestionBankResult } from "@/lib/question-bank";
import Image from "next/image";

type QuestionResultCardProps = {
  question: QuestionBankResult;
};

export function QuestionResultCard({ question }: QuestionResultCardProps) {
  const correctSet = new Set(
    question.type === "TRUE_FALSE"
      ? [question.correctAnswer]
      : question.correctAnswer.split("، ").map((s) => s.trim())
  );

  const isCorrectOption = (option: string) => correctSet.has(option.trim());

  return (
    <Card className="border bg-background shadow-none">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{question.courseTitle}</Badge>
          <Badge variant="outline">{question.quizTitle}</Badge>
        </div>

        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
          {question.text}
        </p>

        {question.imageUrl && (
          <div className="relative w-full max-w-md aspect-video rounded-md overflow-hidden border">
            <Image
              src={question.imageUrl}
              alt="صورة السؤال"
              fill
              className="object-contain"
            />
          </div>
        )}

        {question.options.length > 0 && (
          <ul className="space-y-2">
            {question.options.map((option, index) => {
              const isCorrect = isCorrectOption(option);
              return (
                <li
                  key={index}
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                    isCorrect
                      ? "border-green-500/50 bg-green-50 dark:bg-green-950/20"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <span className="font-semibold text-muted-foreground shrink-0">
                    {index + 1}.
                  </span>
                  <span className="flex-1">{option}</span>
                  {isCorrect && (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="rounded-md border border-green-500/30 bg-green-50 dark:bg-green-950/20 px-3 py-2">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">
            الإجابة الصحيحة
          </p>
          <p className="text-sm font-medium">{question.correctAnswer}</p>
        </div>

        {question.explanation && (
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              الشرح
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {question.explanation}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
