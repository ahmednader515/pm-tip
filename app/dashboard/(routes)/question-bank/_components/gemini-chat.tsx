"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { getWelcomeMessage } from "@/lib/question-bank-settings";
import type { ChatAttachment, ChatHistoryMessage } from "@/lib/gemini/multimodal";
import { GeminiComposer } from "./gemini-composer";
import { GeminiMessage, type UIMessage } from "./gemini-message";

const SUGGESTIONS = ["إدارة المخاطر", "PMBOK", "الجدول الزمني", "شرح سؤال"];

type GeminiChatProps = {
  displayName: string;
};

export function GeminiChat({ displayName }: GeminiChatProps) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const buildHistory = useCallback(
    (currentMessages: UIMessage[]): ChatHistoryMessage[] =>
      currentMessages
        .filter((m) => !m.streaming && m.content.trim())
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
          attachments: m.role === "user" ? m.attachments : undefined,
        })),
    []
  );

  const streamChat = useCallback(
    async (
      userContent: string,
      attachments: ChatAttachment[],
      historyMessages: UIMessage[]
    ) => {
      const assistantId = `assistant-${Date.now()}`;
      abortRef.current = new AbortController();

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          streaming: true,
        },
      ]);
      setStreaming(true);

      try {
        const res = await fetch("/api/student/question-bank/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userContent,
            attachments,
            history: buildHistory(historyMessages),
          }),
          signal: abortRef.current.signal,
        });

        if (!res.body) {
          throw new Error("Request failed");
        }

        if (
          !res.ok &&
          !res.headers.get("content-type")?.includes("text/event-stream")
        ) {
          throw new Error("Request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            let payload: { type: string; text?: string; message?: string };
            try {
              payload = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (payload.type === "chunk" && payload.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + payload.text }
                    : m
                )
              );
              scrollToBottom();
            } else if (payload.type === "error") {
              throw new Error(
                payload.message ?? "حدث خطأ أثناء المعالجة."
              );
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    streaming: false,
                    content: m.content || "تم إيقاف الإنشاء.",
                  }
                : m
            )
          );
          return;
        }

        const errMessage =
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء المعالجة. يرجى المحاولة مرة أخرى.";

        toast.error("فشل إرسال الرسالة");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, content: errMessage }
              : m
          )
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
        scrollToBottom();
      }
    },
    [buildHistory, scrollToBottom]
  );

  const sendMessage = useCallback(
    async (content: string, attachments: ChatAttachment[]) => {
      const userMessage: UIMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      scrollToBottom();

      await streamChat(content, attachments, nextMessages);
    },
    [messages, scrollToBottom, streamChat]
  );

  const handleNewChat = () => {
    if (streaming) abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleRegenerate = async () => {
    const lastUserIndex = [...messages]
      .map((m, i) => ({ m, i }))
      .reverse()
      .find(({ m }) => m.role === "user")?.i;

    if (lastUserIndex === undefined || streaming) return;

    const lastUser = messages[lastUserIndex];
    const historyBefore = messages.slice(0, lastUserIndex);
    const trimmed = messages.slice(0, lastUserIndex + 1);

    setMessages(trimmed);
    await streamChat(
      lastUser.content,
      lastUser.attachments ?? [],
      historyBefore.concat(lastUser)
    );
  };

  const lastMessage = messages[messages.length - 1];
  const showRegenerate =
    !streaming &&
    messages.length > 0 &&
    lastMessage?.role === "assistant" &&
    !lastMessage.streaming;

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-brand" />
          <h1 className="text-lg font-semibold">{displayName}</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleNewChat}
          disabled={streaming && messages.length === 0}
        >
          <Plus className="h-4 w-4 ml-2" />
          محادثة جديدة
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-2xl text-white">
                ✦
              </div>
              <h2 className="text-2xl font-semibold">
                {getWelcomeMessage(displayName)}
              </h2>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => sendMessage(suggestion, [])}
                  disabled={streaming}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <GeminiMessage
                key={message.id}
                message={message}
                displayName={displayName}
                showRegenerate={
                  showRegenerate && index === messages.length - 1
                }
                onRegenerate={handleRegenerate}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <GeminiComposer
        disabled={false}
        streaming={streaming}
        onSend={sendMessage}
        onStop={handleStop}
      />
    </div>
  );
}
