"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type GeminiMarkdownProps = {
  content: string;
  className?: string;
};

export function GeminiMarkdown({ content, className }: GeminiMarkdownProps) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2",
        "prose-pre:my-3 prose-pre:bg-muted prose-pre:text-foreground",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
