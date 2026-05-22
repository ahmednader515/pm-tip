"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "@/components/file-upload";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Home, Plus, Trash2, Save } from "lucide-react";
import type {
    HomepageContent,
    HomepageFeature,
    HomepageFeatureIcon,
    HomepageTestimonial,
} from "@/lib/homepage";

const FEATURE_ICON_OPTIONS: { value: HomepageFeatureIcon; label: string }[] = [
    { value: "star", label: "نجمة" },
    { value: "users", label: "مجتمع" },
    { value: "award", label: "شهادة" },
    { value: "book", label: "كتاب" },
    { value: "bookopen", label: "كتاب مفتوح" },
];

export function HomepageEditor({
    apiBase,
}: {
    apiBase: "/api/admin/homepage" | "/api/teacher/homepage";
}) {
    const router = useRouter();
    const [content, setContent] = useState<HomepageContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(apiBase);
                if (res.ok) {
                    setContent(await res.json());
                } else {
                    toast.error("فشل تحميل إعدادات الصفحة الرئيسية");
                }
            } catch {
                toast.error("فشل تحميل إعدادات الصفحة الرئيسية");
            } finally {
                setLoading(false);
            }
        })();
    }, [apiBase]);

    const handleSave = async () => {
        if (!content) return;
        setSaving(true);
        try {
            const res = await fetch(apiBase, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(content),
            });
            if (res.ok) {
                setContent(await res.json());
                toast.success("تم حفظ إعدادات الصفحة الرئيسية");
                router.refresh();
            } else {
                const err = await res.text();
                toast.error(err || "فشل الحفظ");
            }
        } catch {
            toast.error("فشل الحفظ");
        } finally {
            setSaving(false);
        }
    };

    const updateTestimonial = (index: number, patch: Partial<HomepageTestimonial>) => {
        if (!content) return;
        const testimonials = [...content.testimonials];
        testimonials[index] = { ...testimonials[index], ...patch };
        setContent({ ...content, testimonials });
    };

    const addTestimonial = () => {
        if (!content) return;
        setContent({
            ...content,
            testimonials: [
                ...content.testimonials,
                {
                    name: "",
                    grade: "",
                    testimonial: "",
                    avatarUrl: "/male.png",
                },
            ],
        });
    };

    const removeTestimonial = (index: number) => {
        if (!content || content.testimonials.length <= 1) {
            toast.error("يجب أن يكون هناك رأي واحد على الأقل");
            return;
        }
        setContent({
            ...content,
            testimonials: content.testimonials.filter((_, i) => i !== index),
        });
    };

    const updateFeature = (index: number, patch: Partial<HomepageFeature>) => {
        if (!content) return;
        const features = [...content.features];
        features[index] = { ...features[index], ...patch };
        setContent({ ...content, features });
    };

    const addFeature = () => {
        if (!content) return;
        setContent({
            ...content,
            features: [
                ...content.features,
                { title: "", description: "", icon: "star" },
            ],
        });
    };

    const removeFeature = (index: number) => {
        if (!content || content.features.length <= 1) {
            toast.error("يجب أن تكون هناك ميزة واحدة على الأقل");
            return;
        }
        setContent({
            ...content,
            features: content.features.filter((_, i) => i !== index),
        });
    };

    if (loading) {
        return (
            <div className="p-6 text-muted-foreground">جاري التحميل...</div>
        );
    }

    if (!content) {
        return (
            <div className="p-6 text-muted-foreground">تعذر تحميل المحتوى</div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-4xl text-right" dir="rtl">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Home className="h-8 w-8" />
                    <h1 className="text-2xl font-bold">تعديل الصفحة الرئيسية</h1>
                </div>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    <Save className="h-4 w-4" />
                    {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>صورة المعلّم (القسم الرئيسي)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {content.teacherImageUrl && (
                        <div className="relative w-32 h-32 rounded-full border overflow-hidden mx-auto">
                            <Image
                                src={content.teacherImageUrl}
                                alt="صورة المعلّم"
                                fill
                                className="object-contain p-2"
                            />
                        </div>
                    )}
                    <FileUpload
                        endpoint="courseImage"
                        onChange={(res) => {
                            if (res?.url) {
                                setContent({ ...content, teacherImageUrl: res.url });
                            }
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            setContent({ ...content, teacherImageUrl: "/logo.png" })
                        }
                    >
                        استخدام الصورة الافتراضية
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>شعار الهيدر</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {content.headerLogoUrl && (
                        <div className="relative w-24 h-24 mx-auto">
                            <Image
                                src={content.headerLogoUrl}
                                alt="الشعار"
                                fill
                                className="object-contain"
                            />
                        </div>
                    )}
                    <FileUpload
                        endpoint="courseImage"
                        onChange={(res) => {
                            if (res?.url) {
                                setContent({ ...content, headerLogoUrl: res.url });
                            }
                        }}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>رقم واتساب (الفوتر)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Label htmlFor="footerPhone">رقم الهاتف</Label>
                    <Input
                        id="footerPhone"
                        value={content.footerPhone}
                        onChange={(e) =>
                            setContent({ ...content, footerPhone: e.target.value })
                        }
                        placeholder="01009560680"
                        dir="ltr"
                        className="mt-2 text-left"
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>آراء الطلاب</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addTestimonial}>
                        <Plus className="h-4 w-4 ml-1" />
                        إضافة رأي
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {content.testimonials.map((t, index) => (
                        <div
                            key={index}
                            className="border rounded-lg p-4 space-y-3 relative"
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 left-2 text-destructive"
                                onClick={() => removeTestimonial(index)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <Label>الاسم</Label>
                                    <Input
                                        value={t.name}
                                        onChange={(e) =>
                                            updateTestimonial(index, { name: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>الصف / المرحلة</Label>
                                    <Input
                                        value={t.grade}
                                        onChange={(e) =>
                                            updateTestimonial(index, { grade: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>التعليق</Label>
                                <Textarea
                                    value={t.testimonial}
                                    rows={3}
                                    onChange={(e) =>
                                        updateTestimonial(index, {
                                            testimonial: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div>
                                <Label>صورة الطالب (اختياري)</Label>
                                {t.avatarUrl && (
                                    <div className="relative w-16 h-16 rounded-full overflow-hidden my-2">
                                        <Image
                                            src={t.avatarUrl}
                                            alt=""
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                )}
                                <FileUpload
                                    endpoint="courseImage"
                                    onChange={(res) => {
                                        if (res?.url) {
                                            updateTestimonial(index, { avatarUrl: res.url });
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>مميزات المنصة</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                        <Plus className="h-4 w-4 ml-1" />
                        إضافة ميزة
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {content.features.map((f, index) => (
                        <div
                            key={index}
                            className="border rounded-lg p-4 space-y-3 relative"
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 left-2 text-destructive"
                                onClick={() => removeFeature(index)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <div>
                                <Label>العنوان</Label>
                                <Input
                                    value={f.title}
                                    onChange={(e) =>
                                        updateFeature(index, { title: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <Label>الوصف</Label>
                                <Textarea
                                    value={f.description}
                                    rows={2}
                                    onChange={(e) =>
                                        updateFeature(index, {
                                            description: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div>
                                <Label>الأيقونة</Label>
                                <Select
                                    value={f.icon}
                                    onValueChange={(v) =>
                                        updateFeature(index, {
                                            icon: v as HomepageFeatureIcon,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FEATURE_ICON_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="flex justify-start pb-8">
                <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
                    <Save className="h-4 w-4" />
                    {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
                </Button>
            </div>
        </div>
    );
}
