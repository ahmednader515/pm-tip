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
import { useTranslations } from "next-intl";
import { toLocaleText, type LocaleText } from "@/lib/localized";
import type {
    HomepageContent,
    HomepageFeature,
    HomepageFeatureIcon,
    HomepageTestimonial,
} from "@/lib/homepage";

const FEATURE_ICON_VALUES: HomepageFeatureIcon[] = [
    "star",
    "users",
    "award",
    "book",
    "bookopen",
];

const emptyLocaleText = (): LocaleText => ({ ar: "", en: "" });

function LocaleTextInputs({
    value,
    onChange,
    arLabel,
    enLabel,
    multiline,
    rows = 2,
}: {
    value: LocaleText;
    onChange: (next: LocaleText) => void;
    arLabel: string;
    enLabel: string;
    multiline?: boolean;
    rows?: number;
}) {
    const Field = multiline ? Textarea : Input;
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div>
                <Label>{arLabel}</Label>
                <Field
                    className="mt-1"
                    value={value.ar}
                    rows={multiline ? rows : undefined}
                    onChange={(e) =>
                        onChange({ ...value, ar: e.target.value })
                    }
                />
            </div>
            <div>
                <Label>{enLabel}</Label>
                <Field
                    className="mt-1"
                    dir="ltr"
                    value={value.en}
                    rows={multiline ? rows : undefined}
                    onChange={(e) =>
                        onChange({ ...value, en: e.target.value })
                    }
                />
            </div>
        </div>
    );
}

export function HomepageEditor({
    apiBase,
}: {
    apiBase: "/api/admin/homepage" | "/api/teacher/homepage";
}) {
    const router = useRouter();
    const tCommon = useTranslations("common");
    const tEditor = useTranslations("editor");
    const t = useTranslations("editor.homepage");
    const [content, setContent] = useState<HomepageContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(apiBase);
                if (res.ok) {
                    const raw = await res.json();
                    setContent({
                        ...raw,
                        testimonials: (raw.testimonials ?? []).map(
                            (item: HomepageTestimonial) => ({
                                ...item,
                                name: toLocaleText(item.name),
                                grade: toLocaleText(item.grade),
                                testimonial: toLocaleText(item.testimonial),
                            })
                        ),
                        features: (raw.features ?? []).map((f: HomepageFeature) => ({
                            ...f,
                            title: toLocaleText(f.title),
                            description: toLocaleText(f.description),
                        })),
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
                    name: emptyLocaleText(),
                    grade: emptyLocaleText(),
                    testimonial: emptyLocaleText(),
                    avatarUrl: "/male.png",
                },
            ],
        });
    };

    const removeTestimonial = (index: number) => {
        if (!content || content.testimonials.length <= 1) {
            toast.error(t("minOneTestimonial"));
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
                {
                    title: emptyLocaleText(),
                    description: emptyLocaleText(),
                    icon: "star",
                },
            ],
        });
    };

    const removeFeature = (index: number) => {
        if (!content || content.features.length <= 1) {
            toast.error(t("minOneFeature"));
            return;
        }
        setContent({
            ...content,
            features: content.features.filter((_, i) => i !== index),
        });
    };

    if (loading) {
        return (
            <div className="p-6 text-muted-foreground">{t("loading")}</div>
        );
    }

    if (!content) {
        return (
            <div className="p-6 text-muted-foreground">{t("loadError")}</div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Home className="h-8 w-8" />
                    <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
                </div>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    <Save className="h-4 w-4" />
                    {saving ? t("saving") : t("saveChanges")}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("teacherImage")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {content.teacherImageUrl && (
                        <div className="relative w-32 h-32 rounded-full border overflow-hidden mx-auto">
                            <Image
                                src={content.teacherImageUrl}
                                alt={t("teacherImageAlt")}
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
                        {t("useDefaultImage")}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t("headerLogo")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {content.headerLogoUrl && (
                        <div className="relative w-24 h-24 mx-auto">
                            <Image
                                src={content.headerLogoUrl}
                                alt={t("logoAlt")}
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
                    <CardTitle>{t("footerWhatsapp")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Label htmlFor="footerPhone">{t("phoneNumber")}</Label>
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
                    <CardTitle>{t("testimonials")}</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addTestimonial}>
                        <Plus className="h-4 w-4 rtl:ml-1 ltr:mr-1" />
                        {t("addTestimonial")}
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {content.testimonials.map((item, index) => (
                        <div
                            key={index}
                            className="border rounded-lg p-4 space-y-3 relative"
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 start-2 text-destructive"
                                onClick={() => removeTestimonial(index)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <LocaleTextInputs
                                value={toLocaleText(item.name)}
                                onChange={(name) => updateTestimonial(index, { name })}
                                arLabel={`${tCommon("arabicLabel")} — ${t("name")}`}
                                enLabel={`${tCommon("englishLabel")} — ${tEditor("nameEn")}`}
                            />
                            <LocaleTextInputs
                                value={toLocaleText(item.grade)}
                                onChange={(grade) => updateTestimonial(index, { grade })}
                                arLabel={`${tCommon("arabicLabel")} — ${t("grade")}`}
                                enLabel={`${tCommon("englishLabel")} — ${tEditor("gradeEn")}`}
                            />
                            <LocaleTextInputs
                                value={toLocaleText(item.testimonial)}
                                onChange={(testimonial) =>
                                    updateTestimonial(index, { testimonial })
                                }
                                arLabel={`${tCommon("arabicLabel")} — ${t("comment")}`}
                                enLabel={`${tCommon("englishLabel")} — ${tEditor("testimonialEn")}`}
                                multiline
                                rows={3}
                            />
                            <div>
                                <Label>{t("studentPhoto")}</Label>
                                {item.avatarUrl && (
                                    <div className="relative w-16 h-16 rounded-full overflow-hidden my-2">
                                        <Image
                                            src={item.avatarUrl}
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
                    <CardTitle>{t("features")}</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                        <Plus className="h-4 w-4 rtl:ml-1 ltr:mr-1" />
                        {t("addFeature")}
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
                                className="absolute top-2 start-2 text-destructive"
                                onClick={() => removeFeature(index)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <LocaleTextInputs
                                value={toLocaleText(f.title)}
                                onChange={(title) => updateFeature(index, { title })}
                                arLabel={`${tCommon("arabicLabel")} — ${t("title")}`}
                                enLabel={`${tCommon("englishLabel")} — ${tEditor("featureTitleEn")}`}
                            />
                            <LocaleTextInputs
                                value={toLocaleText(f.description)}
                                onChange={(description) =>
                                    updateFeature(index, { description })
                                }
                                arLabel={`${tCommon("arabicLabel")} — ${t("description")}`}
                                enLabel={`${tCommon("englishLabel")} — ${tEditor("featureDescriptionEn")}`}
                                multiline
                                rows={2}
                            />
                            <div>
                                <Label>{t("icon")}</Label>
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
                                        {FEATURE_ICON_VALUES.map((value) => (
                                            <SelectItem key={value} value={value}>
                                                {t(`icons.${value}`)}
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
                    {saving ? t("saving") : t("saveChanges")}
                </Button>
            </div>
        </div>
    );
}
