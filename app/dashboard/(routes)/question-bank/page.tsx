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
          ابحث في جميع أسئلة الاختبارات المنشورة. اكتب كلمات مفتاحية للحصول على
          السؤال كاملاً مع الخيارات والإجابة الصحيحة والشرح.
        </p>
      </div>

      <QuestionBankChat displayName={displayName} />
    </div>
  );
}
