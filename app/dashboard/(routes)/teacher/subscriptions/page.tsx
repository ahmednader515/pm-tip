"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CourseOption = { id: string; title: string; imageUrl: string | null; isPublished: boolean };
type SubCourse = { course: { id: string; title: string; imageUrl: string | null } };
type Subscription = {
  id: string;
  title: string;
  type: string;
  price: number;
  courses: SubCourse[];
  createdAt: string;
};

export default function TeacherSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "MONTHLY" as "MONTHLY" | "YEARLY",
    price: "",
    courseIds: [] as string[],
  });

  useEffect(() => {
    fetchSubscriptions();
    fetchCourses();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch("/api/teacher/subscriptions");
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      } else {
        toast.error("فشل تحميل الاشتراكات");
      }
    } catch (e) {
      toast.error("فشل تحميل الاشتراكات");
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/teacher/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", type: "MONTHLY", price: "", courseIds: [] });
    setDialogOpen(true);
  };

  const openEdit = (s: Subscription) => {
    setEditingId(s.id);
    setForm({
      title: s.title,
      type: s.type as "MONTHLY" | "YEARLY",
      price: String(s.price),
      courseIds: s.courses.map((sc) => sc.course.id),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const title = form.title.trim();
    const priceNum = parseFloat(form.price);
    if (!title) {
      toast.error("أدخل عنوان الاشتراك");
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("أدخل سعراً صحيحاً");
      return;
    }
    if (form.courseIds.length === 0) {
      toast.error("اختر كورس واحد على الأقل");
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `/api/teacher/subscriptions/${editingId}`
        : "/api/teacher/subscriptions";
      const method = editingId ? "PATCH" : "POST";
      const body = editingId
        ? { title, type: form.type, price: priceNum, courseIds: form.courseIds }
        : { title, type: form.type, price: priceNum, courseIds: form.courseIds };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(editingId ? "تم تحديث الاشتراك" : "تم إنشاء الاشتراك");
        setDialogOpen(false);
        fetchSubscriptions();
      } else {
        const err = await res.text();
        toast.error(err || "حدث خطأ");
      }
    } catch (e) {
      toast.error("حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/teacher/subscriptions/${deleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("تم حذف الاشتراك");
        setDeleteId(null);
        fetchSubscriptions();
      } else {
        toast.error("فشل الحذف");
      }
    } catch (e) {
      toast.error("فشل الحذف");
    }
  };

  const toggleCourse = (courseId: string) => {
    setForm((prev) => ({
      ...prev,
      courseIds: prev.courseIds.includes(courseId)
        ? prev.courseIds.filter((id) => id !== courseId)
        : [...prev.courseIds, courseId],
    }));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الاشتراكات</h1>
        <Button onClick={openCreate} className="bg-brand hover:bg-brand/90 text-white">
          <Plus className="h-4 w-4 ml-2" />
          إنشاء اشتراك
        </Button>
      </div>

      {subscriptions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">
              لا توجد اشتراكات. أنشئ اشتراكاً شهرياً أو سنوياً واختر الكورسات المتضمنة.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{s.title}</CardTitle>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteId(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {s.type === "MONTHLY" ? "شهري" : "سنوي"}
                  </Badge>
                  <span className="font-semibold text-brand">{s.price} ج.م</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {s.courses.length} كورس
                </p>
                <ul className="mt-2 text-sm list-disc list-inside text-muted-foreground">
                  {s.courses.slice(0, 3).map((sc) => (
                    <li key={sc.course.id}>{sc.course.title}</li>
                  ))}
                  {s.courses.length > 3 && (
                    <li>و {s.courses.length - 3} آخر</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل الاشتراك" : "اشتراك جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>العنوان</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="مثال: باقة المواد الأساسية"
              />
            </div>
            <div>
              <Label>النوع</Label>
              <Select
                value={form.type}
                onValueChange={(v: "MONTHLY" | "YEARLY") =>
                  setForm((p) => ({ ...p, type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">شهري</SelectItem>
                  <SelectItem value="YEARLY">سنوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>السعر (ج.م)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <Label>الكورسات المتضمنة</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 mt-1">
                {courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد كورسات. أنشئ كورسات أولاً.</p>
                ) : (
                  courses.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.courseIds.includes(c.id)}
                        onChange={() => toggleCourse(c.id)}
                        className="rounded"
                      />
                      <span className={!c.isPublished ? "text-muted-foreground" : ""}>
                        {c.title}
                        {!c.isPublished && " (غير منشور)"}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || form.courseIds.length === 0}
              className="bg-brand hover:bg-brand/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الاشتراك</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا الاشتراك؟ لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
