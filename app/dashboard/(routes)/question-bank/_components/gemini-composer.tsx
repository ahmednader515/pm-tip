"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, Square, X } from "lucide-react";
import {
  fileToChatAttachment,
  isImageMimeType,
  type ChatAttachment,
} from "@/lib/gemini/multimodal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type GeminiComposerProps = {
  disabled?: boolean;
  streaming?: boolean;
  onSend: (message: string, attachments: ChatAttachment[]) => void;
  onStop?: () => void;
};

export function GeminiComposer({
  disabled = false,
  streaming = false,
  onSend,
  onStop,
}: GeminiComposerProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend =
    !disabled && !streaming && (input.trim().length > 0 || attachments.length > 0);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;

    onSend(input.trim(), attachments);
    setInput("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    try {
      const next = await Promise.all(files.map(fileToChatAttachment));
      setAttachments((prev) => [...prev, ...next].slice(0, 5));
    } catch {
      toast.error("فشل رفع الملف");
    } finally {
      e.target.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <form onSubmit={handleSubmit} className="relative">
          {attachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <div key={index} className="relative">
                  {isImageMimeType(attachment.mimeType) ? (
                    <img
                      src={`data:${attachment.mimeType};base64,${attachment.data}`}
                      alt={attachment.name ?? "preview"}
                      className="h-16 w-16 rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="flex h-16 min-w-[80px] items-center rounded-lg border bg-muted px-3 text-xs">
                      {attachment.name ?? "PDF"}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="absolute -left-2 -top-2 rounded-full bg-foreground text-background p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 rounded-2xl border bg-card px-3 py-2 shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={disabled || streaming}
              onClick={() => fileInputRef.current?.click()}
              title="إرفاق صورة أو PDF"
            >
              <Paperclip className="h-5 w-5" />
            </Button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="اسأل Gemini..."
              disabled={disabled || streaming}
              rows={1}
              className={cn(
                "max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm",
                "outline-none placeholder:text-muted-foreground"
              )}
            />

            {streaming ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-9 w-9 shrink-0"
                onClick={onStop}
                title="إيقاف"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 shrink-0 bg-brand hover:bg-brand/90"
                disabled={!canSend}
                title="إرسال"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            قد يرتكب Gemini أخطاء. تحقق من المعلومات المهمة.
          </p>
        </form>
      </div>
    </div>
  );
}
