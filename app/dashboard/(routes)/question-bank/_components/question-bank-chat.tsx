"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { getWelcomeMessage } from "@/lib/question-bank-settings";

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  content: string;
};

const EXAMPLE_PROMPTS = ["إدارة المخاطر", "PMBOK", "الجدول الزمني"];

type QuestionBankChatProps = {
  displayName: string;
};

export function QuestionBankChat({ displayName }: QuestionBankChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      content: getWelcomeMessage(displayName),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === "welcome" && message.role === "bot"
          ? { ...message, content: getWelcomeMessage(displayName) }
          : message
      )
    );
  }, [displayName]);

  const buildHistory = (currentMessages: ChatMessage[]) =>
    currentMessages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));

  const handleSend = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const history = buildHistory(messages);

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/student/question-bank/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!res.ok) {
        let errMessage =
          "حدث خطأ أثناء المعالجة. يرجى المحاولة مرة أخرى.";

        const errText = await res.text();
        try {
          const data = JSON.parse(errText) as { message?: string };
          if (typeof data.message === "string" && data.message.trim()) {
            errMessage = data.message.trim();
          }
        } catch {
          if (errText.trim()) errMessage = errText;
        }

        if (res.status === 503) {
          toast.error("خدمة الذكاء الاصطناعي غير متاحة حالياً");
        } else if (res.status === 429) {
          toast.error("تم تجاوز حد الاستخدام مؤقتاً");
        } else {
          toast.error("فشل إرسال الرسالة");
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `bot-error-${Date.now()}`,
            role: "bot",
            content: errMessage,
          },
        ]);
        return;
      }

      const data = await res.json();
      const reply =
        typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : "عذراً، لم أتمكن من إعداد إجابة. يرجى إعادة صياغة سؤالك.";

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: "bot",
          content: reply,
        },
      ]);
    } catch {
      toast.error("فشل إرسال الرسالة");
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-error-${Date.now()}`,
          role: "bot",
          content: "حدث خطأ أثناء المعالجة. يرجى المحاولة مرة أخرى.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-h-[700px] border rounded-lg bg-card">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[90%] ${
                message.role === "user"
                  ? "rounded-2xl rounded-tr-sm bg-brand text-white px-4 py-3"
                  : "rounded-2xl rounded-tl-sm bg-muted px-4 py-3 w-full max-w-2xl"
              }`}
            >
              {message.role === "bot" && (
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {displayName}
                  </span>
                </div>
              )}
              <p
                className={`text-sm leading-relaxed whitespace-pre-wrap ${
                  message.role === "user" ? "text-white" : "text-foreground"
                }`}
              >
                {message.content}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">جاري الكتابة...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => handleSend(prompt)}
              className="text-xs"
            >
              {prompt}
            </Button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اكتب رسالتك هنا..."
            disabled={loading}
            className="flex-1 h-11"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-11 px-4 bg-brand hover:bg-brand/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
