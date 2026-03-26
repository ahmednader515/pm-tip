"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Course } from "@prisma/client";
import axios from "axios";
import { toast } from "sonner";
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
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState(Boolean((initialData as any).certificateEnabled));

  const onSave = async () => {
    try {
      setIsSaving(true);
      await axios.patch(`/api/courses/${courseId}`, { certificateEnabled: enabled });
      toast.success("تم تحديث إعدادات الشهادة");
      setIsEditing(false);
      router.refresh();
    } catch {
      toast.error("حدث خطأ أثناء حفظ إعدادات الشهادة");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-6 border bg-card rounded-md p-4">
      <div className="font-medium flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4" />
          <span>إعدادات الشهادة</span>
        </div>
        <Button onClick={() => setIsEditing((v) => !v)} variant="ghost">
          {isEditing ? "إلغاء" : (
            <>
              <Pencil className="h-4 w-4 mr-2" />
              تعديل
            </>
          )}
        </Button>
      </div>

      {!isEditing ? (
        <p className="text-sm mt-2 text-muted-foreground">
          {(initialData as any).certificateEnabled
            ? "هذا الكورس يمنح شهادة بعد إكمال جميع الفصول والاختبارات."
            : "هذا الكورس لا يمنح شهادة."}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="certificateEnabled">تفعيل الشهادة لهذا الكورس</Label>
            <Checkbox
              id="certificateEnabled"
              checked={enabled}
              onCheckedChange={(v) => setEnabled(Boolean(v))}
              disabled={isSaving}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            يحصل الطالب على الشهادة عند إكمال كل الفصول + كل الاختبارات في هذا الكورس.
          </p>
          <Button onClick={onSave} disabled={isSaving}>
            حفظ
          </Button>
        </div>
      )}
    </div>
  );
};

