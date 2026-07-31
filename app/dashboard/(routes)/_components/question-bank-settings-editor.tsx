"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import type { QuestionBankSettingsContent } from "@/lib/question-bank-settings";
import { DEFAULT_QUESTION_BANK_DISPLAY_NAME } from "@/lib/question-bank-settings";

export function QuestionBankSettingsEditor({
  apiBase,
}: {
  apiBase: "/api/admin/question-bank/settings" | "/api/teacher/question-bank/settings";
}) {
  const router = useRouter();
  const tCommon = useTranslations("common");
  const tEditor = useTranslations("editor");
  const t = useTranslations("editor.questionBank");
  const [settings, setSettings] = useState<QuestionBankSettingsContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiBase);
        if (res.ok) {
          const data = await res.json();
          setSettings({
            displayName: data.displayName ?? "",
            displayNameEn: data.displayNameEn ?? "",
          });
        } else {
          toast.error(t("loadFailed"));
        }
      } catch {
        toast.error(t("loadFailed"));
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase, t]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSettings(await res.json());
        toast.success(t("saveSuccess"));
        router.refresh();
      } else {
        const err = await res.text();
        toast.error(err || t("saveFailed"));
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <p className="text-muted-foreground text-center py-12">
        {t("loadError")}
      </p>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="h-7 w-7" />
          {t("pageTitle")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("displayNameTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">
              {tCommon("arabicLabel")} — {t("displayName")}
            </Label>
            <Input
              id="displayName"
              value={settings.displayName}
              onChange={(e) =>
                setSettings({ ...settings, displayName: e.target.value })
              }
              placeholder={DEFAULT_QUESTION_BANK_DISPLAY_NAME}
              maxLength={100}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              {t("displayNameHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayNameEn">
              {tCommon("englishLabel")} — {tEditor("displayNameEn")}
            </Label>
            <Input
              id="displayNameEn"
              dir="ltr"
              value={settings.displayNameEn}
              onChange={(e) =>
                setSettings({ ...settings, displayNameEn: e.target.value })
              }
              placeholder="Question Bank"
              maxLength={100}
              className="h-11"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !settings.displayName.trim()}
            className="bg-brand hover:bg-brand/90"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin rtl:ml-2 ltr:mr-2" />
            ) : (
              <Save className="h-4 w-4 rtl:ml-2 ltr:mr-2" />
            )}
            {t("save")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
