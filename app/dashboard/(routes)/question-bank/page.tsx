"use client";

import { MessageCircle } from "lucide-react";
import { QuestionBankChat } from "./_components/question-bank-chat";
import { useQuestionBankSettings } from "@/components/question-bank-settings-provider";

export default function QuestionBankPage() {
  const { displayName } = useQuestionBankSettings();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="h-7 w-7" />
          {displayName}
        </h1>
        <p className="text-muted-foreground mt-1">
          تحدث مع المساعد الذكي بشكل طبيعي. يجيب بناءً على أسئلة الاختبارات
          المنشورة وإجاباتها وشروحاتها في بنك الأسئلة.
        </p>
      </div>

      <QuestionBankChat displayName={displayName} />
    </div>
  );
}
