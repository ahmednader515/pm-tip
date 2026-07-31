"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Award, Download } from "lucide-react";
import { localizedField } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

type CertificateStatus = {
  courseId: string;
  courseTitle: string;
  courseTitleEn?: string | null;
  certificateEnabled: boolean;
  totalChapters: number;
  completedChapters: number;
  totalQuizzes: number;
  completedQuizzes: number;
  totalContent: number;
  eligible: boolean;
};

export default function CourseCertificatePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const t = useTranslations("course");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { courseId } = use(params);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/certificate-status`, { cache: "no-store" });
        if (!res.ok) {
          router.push("/dashboard");
          return;
        }
        const data = await res.json();
        setStatus(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, router]);

  const downloadCertificate = async () => {
    if (!status?.eligible || !name.trim()) return;
    setDownloading(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = "/certificate.png";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load certificate image"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(img, 0, 0);

      const x = canvas.width / 2;
      const y = Math.round(canvas.height * 0.5);
      const fontSize = Math.max(34, Math.round(canvas.width * 0.05));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#111827";
      ctx.font = `700 ${fontSize}px Cairo, Arial, sans-serif`;
      ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.09));
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeText(name.trim(), x, y);
      ctx.fillText(name.trim(), x, y);

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `course-certificate-${courseId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
return <div className="p-6">{tCommon("loading")}</div>;
  }

  if (!status || !status.certificateEnabled) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
<CardTitle>{t("certificateUnavailable")}</CardTitle>
          </CardHeader>
          <CardContent>
{t("certificateNotEnabled")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
{t("courseCertificateTitle")}
          </CardTitle>
          <CardDescription>
            {localizedField(status as unknown as Record<string, unknown>, "courseTitle", locale)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
{t("chaptersProgress", { completed: status.completedChapters, total: status.totalChapters })}
            {" • "}
{t("quizzesProgress", { completed: status.completedQuizzes, total: status.totalQuizzes })}
          </div>

          {status.eligible ? (
            <div className="space-y-3 max-w-md">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
placeholder={t("nameOnCertificate")}
                dir="auto"
              />
              <Button
                onClick={downloadCertificate}
                disabled={downloading || !name.trim()}
                size="lg"
                className="w-full gap-2 bg-brand text-white hover:bg-brand/90"
              >
                <Download className="h-5 w-5" />
{downloading ? t("preparingCertificate") : t("downloadCertificate")}
              </Button>
            </div>
          ) : (
            <div className="text-sm">
{t("completeFirst")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

