"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import type { QuestionBankResult } from "@/lib/question-bank";
import { getWelcomeMessage } from "@/lib/question-bank-settings";
import { QuestionResultCard } from "./question-result-card";

type ChatMessage =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "bot";
      content: string;
      results?: QuestionBankResult[];
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

  const handleSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/student/question-bank/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      if (!res.ok) {
        toast.error("فشل البحث في بنك الأسئلة");
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-error-${Date.now()}`,
            role: "bot",
            content: "حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.",
          },
        ]);
        return;
      }

      const data = await res.json();
      const results: QuestionBankResult[] = data.results ?? [];

      if (results.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-empty-${Date.now()}`,
            role: "bot",
            content: "لم يتم العثور على أسئلة مطابقة. جرّب كلمات مفتاحية أخرى.",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-results-${Date.now()}`,
            role: "bot",
            content: `تم العثور على ${results.length} ${results.length === 1 ? "سؤال" : "أسئلة"}:`,
            results,
          },
        ]);
      }
    } catch {
      toast.error("فشل البحث في بنك الأسئلة");
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-error-${Date.now()}`,
          role: "bot",
          content: "حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(input);
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
              className={`max-w-[90%] space-y-3 ${
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
                className={`text-sm leading-relaxed ${
                  message.role === "user" ? "text-white" : "text-foreground"
                }`}
              >
                {message.content}
              </p>
              {message.role === "bot" && message.results && (
                <div className="space-y-3 pt-1">
                  {message.results.map((question) => (
                    <QuestionResultCard key={question.id} question={question} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">جاري البحث...</span>
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
              onClick={() => handleSearch(prompt)}
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
            placeholder="اكتب كلمات مفتاحية للبحث في الأسئلة..."
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
