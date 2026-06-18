"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, RotateCcw } from "lucide-react";
import { GeminiMarkdown } from "./gemini-markdown";
import {
  isImageMimeType,
  type ChatAttachment,
} from "@/lib/gemini/multimodal";
import { cn } from "@/lib/utils";

export type UIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  streaming?: boolean;
};

type GeminiMessageProps = {
  message: UIMessage;
  displayName: string;
  onRegenerate?: () => void;
  showRegenerate?: boolean;
};

export function GeminiMessage({
  message,
  displayName,
  onRegenerate,
  showRegenerate = false,
}: GeminiMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "group w-full py-6",
        isUser ? "bg-transparent" : "bg-muted/30"
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl gap-4 px-4">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            isUser
              ? "bg-brand text-white"
              : "bg-gradient-to-br from-blue-500 to-purple-500 text-white"
          )}
        >
          {isUser ? "أنت" : displayName.slice(0, 1)}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {isUser ? "أنت" : displayName}
            </span>

            {!isUser && message.content && !message.streaming && (
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopy}
                  title="نسخ"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                {showRegenerate && onRegenerate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onRegenerate}
                    title="إعادة الإنشاء"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((attachment, index) => (
                <AttachmentPreview key={index} attachment={attachment} />
              ))}
            </div>
          )}

          {message.content ? (
            isUser ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </p>
            ) : (
              <GeminiMarkdown content={message.content} />
            )
          ) : message.streaming ? (
            <span className="inline-block h-4 w-2 animate-pulse bg-foreground/60" />
          ) : null}

          {message.streaming && message.content && (
            <span className="inline-block h-4 w-2 animate-pulse bg-foreground/60" />
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: ChatAttachment }) {
  if (isImageMimeType(attachment.mimeType)) {
    const src = `data:${attachment.mimeType};base64,${attachment.data}`;
    return (
      <img
        src={src}
        alt={attachment.name ?? "attachment"}
        className="max-h-40 rounded-lg border object-cover"
      />
    );
  }

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm">
      {attachment.name ?? "PDF"}
    </div>
  );
}
