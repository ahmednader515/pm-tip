export type ChatAttachment = {
  mimeType: string;
  data: string;
  name?: string;
};

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
};

const MAX_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export function validateAttachments(
  attachments: ChatAttachment[] | undefined
): { valid: ChatAttachment[]; error?: string } {
  if (!attachments?.length) {
    return { valid: [] };
  }

  if (attachments.length > MAX_ATTACHMENTS) {
    return {
      valid: [],
      error: `Maximum ${MAX_ATTACHMENTS} attachments allowed`,
    };
  }

  const valid: ChatAttachment[] = [];

  for (const attachment of attachments) {
    if (!attachment.mimeType || !ALLOWED_MIME_TYPES.has(attachment.mimeType)) {
      return {
        valid: [],
        error: "Only JPEG, PNG, WebP, GIF images and PDF files are allowed",
      };
    }

    if (!attachment.data?.trim()) {
      return { valid: [], error: "Invalid attachment data" };
    }

    const byteLength = estimateBase64Bytes(attachment.data);
    if (byteLength > MAX_FILE_BYTES) {
      return {
        valid: [],
        error: "Each attachment must be 10MB or smaller",
      };
    }

    valid.push({
      mimeType: attachment.mimeType,
      data: attachment.data,
      name: attachment.name,
    });
  }

  return { valid };
}

function estimateBase64Bytes(base64: string): number {
  const normalized = base64.includes(",") ? base64.split(",").pop()! : base64;
  return Math.floor((normalized.length * 3) / 4);
}

export function normalizeBase64(data: string): string {
  return data.includes(",") ? data.split(",").pop()! : data;
}

export async function fileToChatAttachment(file: File): Promise<ChatAttachment> {
  const base64 = await readFileAsDataUrl(file);
  const data = base64.split(",")[1] ?? base64;

  return {
    mimeType: file.type,
    data,
    name: file.name,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
