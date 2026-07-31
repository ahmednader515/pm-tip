"use client";

import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Eye, Pencil, EyeOff, LayoutDashboard, Files } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import axios from "axios";

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Editor } from "@/components/editor";
import { Checkbox } from "@/components/ui/checkbox";
import { IconBadge } from "@/components/icon-badge";
import { AttachmentsForm } from "./attachments-form";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";

interface ChapterAttachment {
    id: string;
    name: string;
    url: string;
    position: number;
    createdAt: Date | string;
}

interface ChapterFormProps {
    initialData: {
        title: string;
        titleEn?: string | null;
        description: string | null;
        descriptionEn?: string | null;
        isFree: boolean;
        isPublished: boolean;
        attachments: ChapterAttachment[];
    };
    courseId: string;
    chapterId: string;
}

const titleSchema = z.object({
    title: z.string().min(1, {
        message: "Title is required",
    }),
    titleEn: z.string().optional(),
});

const descriptionSchema = z.object({
    description: z.string().min(1, {
        message: "Description is required",
    }),
    descriptionEn: z.string().optional(),
});

const accessSchema = z.object({
    isFree: z.boolean().default(false),
});

export const ChapterForm = ({
    initialData,
    courseId,
    chapterId
}: ChapterFormProps) => {
    const tCommon = useTranslations("common");
    const tEditor = useTranslations("editor");
    const t = useTranslations("dashboard.teacher.chapterEditor");
    const tCourseEditor = useTranslations("dashboard.teacher.courseEditor");
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isEditingAccess, setIsEditingAccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    const router = useRouter();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const titleForm = useForm<z.infer<typeof titleSchema>>({
        resolver: zodResolver(titleSchema),
        defaultValues: {
            title: initialData?.title || "",
            titleEn: initialData?.titleEn || "",
        },
    });

    const descriptionForm = useForm<z.infer<typeof descriptionSchema>>({
        resolver: zodResolver(descriptionSchema),
        defaultValues: {
            description: initialData?.description || "",
            descriptionEn: initialData?.descriptionEn || "",
        },
    });

    const accessForm = useForm<z.infer<typeof accessSchema>>({
        resolver: zodResolver(accessSchema),
        defaultValues: {
            isFree: !!initialData.isFree
        }
    });

    const { isSubmitting: isSubmittingTitle, isValid: isValidTitle } = titleForm.formState;
    const { isSubmitting: isSubmittingDescription, isValid: isValidDescription } = descriptionForm.formState;
    const { isSubmitting: isSubmittingAccess, isValid: isValidAccess } = accessForm.formState;

    const onSubmitTitle = async (values: z.infer<typeof titleSchema>) => {
        try {
            const response = await fetch(`/api/courses/${courseId}/chapters/${chapterId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: values.title,
                    titleEn: values.titleEn?.trim() || null,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update chapter title');
            }

            toast.success(t("chapterUpdated"));
            setIsEditingTitle(false);
            router.refresh();
        } catch (error) {
            console.error("[CHAPTER_TITLE]", error);
            toast.error(tCommon("errors.generic"));
        }
    }

    const onSubmitDescription = async (values: z.infer<typeof descriptionSchema>) => {
        try {
            const response = await fetch(`/api/courses/${courseId}/chapters/${chapterId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: values.description,
                    descriptionEn: values.descriptionEn?.trim() || null,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update chapter description');
            }

            toast.success(t("chapterUpdated"));
            setIsEditingDescription(false);
            router.refresh();
        } catch (error) {
            console.error("[CHAPTER_DESCRIPTION]", error);
            toast.error(tCommon("errors.generic"));
        }
    }

    const onSubmitAccess = async (values: z.infer<typeof accessSchema>) => {
        try {
            await fetch(`/api/courses/${courseId}/chapters/${chapterId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values),
            });

            toast.success(t("chapterUpdated"));
            setIsEditingAccess(false);
            router.refresh();
        } catch (error) {
            console.error("[CHAPTER_ACCESS]", error);
            toast.error(tCommon("errors.generic"));
        }
    }

    const onPublish = async () => {
        try {
            setIsLoading(true);
            
            await axios.patch(`/api/courses/${courseId}/chapters/${chapterId}/publish`);
            
            toast.success(initialData.isPublished ? t("chapterUnpublished") : t("chapterPublished"));
            router.refresh();
        } catch {
            toast.error(tCommon("errors.generic"));
        } finally {
            setIsLoading(false);
        }
    }

    if (!isMounted) {
        return null;
    }

    return (
        <div className="space-y-10">
            <div className="flex items-center gap-x-2">
                <IconBadge icon={LayoutDashboard} />
                <h2 className="text-xl">
                    {t("chapterSettingsTitle")}
                </h2>
            </div>
            <div className="space-y-4">
                <div className="border bg-card rounded-md p-4">
                    <div className="font-medium flex items-center justify-between">
                        {t("chapterTitleLabel")}
                        <Button onClick={() => setIsEditingTitle(!isEditingTitle)} variant="ghost">
                            {isEditingTitle ? (
                                <>{tCommon("cancel")}</>
                            ) : (
                                <>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    {tCourseEditor("editTitleAction")}
                                </>
                            )}
                        </Button>
                    </div>
                    {!isEditingTitle && (
                        <div className="text-sm mt-2 space-y-1">
                            <p className={cn(!initialData.title && "text-muted-foreground italic")}>
                                {initialData.title || t("noTitleSet")}
                            </p>
                            {initialData.titleEn && (
                                <p dir="ltr" className="text-xs text-muted-foreground">{initialData.titleEn}</p>
                            )}
                        </div>
                    )}
                    {isEditingTitle && (
                        <Form {...titleForm}>
                            <form
                                onSubmit={titleForm.handleSubmit(onSubmitTitle)}
                                className="space-y-4 mt-4"
                            >
                                <FormField
                                    control={titleForm.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>{tCommon("arabicLabel")}</Label>
                                            <FormControl>
                                                <Input
                                                    disabled={isSubmittingTitle}
                                                    placeholder="e.g. 'Introduction to the course'"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={titleForm.control}
                                    name="titleEn"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>{tCommon("englishLabel")} — {tEditor("titleEn")}</Label>
                                            <FormControl>
                                                <Input
                                                    disabled={isSubmittingTitle}
                                                    dir="ltr"
                                                    placeholder="e.g. Introduction to the course"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex items-center gap-x-2">
                                    <Button
                                        disabled={!isValidTitle || isSubmittingTitle}
                                        type="submit"
                                    >
                                        {tCommon("save")}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    )}
                </div>
                <div className="border bg-card rounded-md p-4">
                    <div className="font-medium flex items-center justify-between">
                        {t("chapterDescriptionLabel")}
                        <Button onClick={() => setIsEditingDescription(!isEditingDescription)} variant="ghost">
                            {isEditingDescription ? (
                                <>{tCommon("cancel")}</>
                            ) : (
                                <>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    {tCourseEditor("editDescriptionAction")}
                                </>
                            )}
                        </Button>
                    </div>
                    {!isEditingDescription && (
                        <div className={cn(
                            "text-sm mt-2 space-y-2",
                            !initialData.description && "text-muted-foreground italic"
                        )}>
                            {!initialData.description && tCourseEditor("noDescriptionShort")}
                            {initialData.description && (
                                <div 
                                    className="prose prose-sm max-w-none space-y-4"
                                    dangerouslySetInnerHTML={{ __html: initialData.description }}
                                />
                            )}
                            {initialData.descriptionEn && (
                                <div
                                    dir="ltr"
                                    className="prose prose-sm max-w-none text-muted-foreground"
                                    dangerouslySetInnerHTML={{ __html: initialData.descriptionEn }}
                                />
                            )}
                        </div>
                    )}
                    {isEditingDescription && (
                        <Form {...descriptionForm}>
                            <form
                                onSubmit={descriptionForm.handleSubmit(onSubmitDescription)}
                                className="space-y-4 mt-4"
                            >
                                <FormField
                                    control={descriptionForm.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>{tCommon("arabicLabel")}</Label>
                                            <FormControl>
                                                <Editor
                                                    onChange={field.onChange}
                                                    value={field.value}
                                                    placeholder="e.g. 'This chapter will cover the basics of...'"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={descriptionForm.control}
                                    name="descriptionEn"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>{tCommon("englishLabel")} — {tEditor("descriptionEn")}</Label>
                                            <FormControl>
                                                <Editor
                                                    onChange={field.onChange}
                                                    value={field.value || ""}
                                                    placeholder="e.g. This chapter will cover the basics of..."
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex items-center gap-x-2">
                                    <Button
                                        disabled={!isValidDescription || isSubmittingDescription}
                                        type="submit"
                                    >
                                        {tCommon("save")}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-x-2">
                    <IconBadge icon={Eye} />
                    <h2 className="text-xl">
                        {t("accessSettingsTitle")}
                    </h2>
                </div>
                <div className="space-y-4 mt-4">
                    <div className="border bg-card rounded-md p-4">
                        <div className="font-medium flex items-center justify-between">
                            {t("accessSettingsTitle")}
                            <Button onClick={() => setIsEditingAccess(!isEditingAccess)} variant="ghost">
                                {isEditingAccess ? (
                                    <>{tCommon("cancel")}</>
                                ) : (
                                    <>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        {t("editAccessAction")}
                                    </>
                                )}
                            </Button>
                        </div>
                        {!isEditingAccess && (
                            <p className={cn(
                                "text-sm mt-2",
                                !initialData.isFree && "text-muted-foreground italic"
                            )}>
                                {initialData.isFree ? t("freePreviewYes") : t("freePreviewNo")}
                            </p>
                        )}
                        {isEditingAccess && (
                            <Form {...accessForm}>
                                <form
                                    onSubmit={accessForm.handleSubmit(onSubmitAccess)}
                                    className="space-y-4 mt-4"
                                >
                                    <FormField
                                        control={accessForm.control}
                                        name="isFree"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                <div className="space-y-1 leading-none">
                                                    <FormDescription>
                                                        {t("freeCheckboxDesc")}
                                                    </FormDescription>
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex items-center gap-x-2">
                                        <Button
                                            disabled={!isValidAccess || isSubmittingAccess}
                                            type="submit"
                                        >
                                            {tCommon("save")}
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-x-2">
                    <IconBadge icon={Files} />
                    <h2 className="text-xl">
                        {t("documentsTitle")}
                    </h2>
                </div>
                <AttachmentsForm
                    initialData={{ attachments: initialData.attachments || [] }}
                    courseId={courseId}
                    chapterId={chapterId}
                />
            </div>

            <div className="border bg-card rounded-md p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">
                            {initialData.isPublished ? t("chapterPublished") : t("chapterUnpublished")}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {initialData.isPublished
                                ? t("chapterPublishedDesc")
                                : t("chapterUnpublishedDesc")}
                        </p>
                    </div>
                    <Button
                        onClick={onPublish}
                        disabled={isLoading}
                        variant={initialData.isPublished ? "outline" : "default"}
                        className="w-full sm:w-auto px-8 py-6 text-base font-semibold"
                    >
                        {initialData.isPublished ? (
                            <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                {tCommon("unpublish")}
                            </>
                        ) : (
                            <>
                                <Eye className="h-4 w-4 mr-2" />
                                {t("publishChapterAction")}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
} 