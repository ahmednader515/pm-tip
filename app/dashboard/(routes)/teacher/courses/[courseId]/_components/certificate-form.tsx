"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Course } from "@prisma/client";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Award, Pencil } from "lucide-react";

interface CertificateFormProps {
  initialData: Course;
  courseId: string;
}

export const CertificateForm = ({ initialData, courseId }: CertificateFormProps) => {
  const router = useRouter();
  const tCommon = useTranslations("common");
  const t = useTranslations("dashboard.teacher.courseEditor");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState(Boolean((initialData as any).certificateEnabled));

  const onSave = async () => {
    try {
      setIsSaving(true);
      await axios.patch(`/api/courses/${courseId}`, { certificateEnabled: enabled });
      toast.success(t("certificateSettingsUpdated"));
      setIsEditing(false);
      router.refresh();
    } catch {
      toast.error(t("certificateSettingsError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-6 border bg-card rounded-md p-4">
      <div className="font-medium flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4" />
          <span>{t("certificateSettingsTitle")}</span>
        </div>
        <Button onClick={() => setIsEditing((v) => !v)} variant="ghost">
          {isEditing ? tCommon("cancel") : (
            <>
              <Pencil className="h-4 w-4 mr-2" />
              {tCommon("edit")}
            </>
          )}
        </Button>
      </div>

      {!isEditing ? (
        <p className="text-sm mt-2 text-muted-foreground">
          {(initialData as any).certificateEnabled
            ? t("certificateEnabledDesc")
            : t("certificateDisabledDesc")}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="certificateEnabled">{t("enableCertificateLabel")}</Label>
            <Checkbox
              id="certificateEnabled"
              checked={enabled}
              onCheckedChange={(v) => setEnabled(Boolean(v))}
              disabled={isSaving}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("certificateHint")}
          </p>
          <Button onClick={onSave} disabled={isSaving}>
            {tCommon("save")}
          </Button>
        </div>
      )}
    </div>
  );
};

