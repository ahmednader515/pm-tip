"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chapter, Course } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { useTranslations } from "next-intl";
import { ChaptersList } from "./chapters-list";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface ChaptersFormProps {
    initialData: Course & { chapters: Chapter[] };
    courseId: string;
}

export const ChaptersForm = ({
    initialData,
    courseId
}: ChaptersFormProps) => {
    const tCommon = useTranslations("common");
    const t = useTranslations("dashboard.teacher.courseEditor");
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [title, setTitle] = useState("");

    const router = useRouter();

    const onCreate = async () => {
        try {
            setIsUpdating(true);
            await axios.post(`/api/courses/${courseId}/chapters`, { title });
            toast.success(t("chapterCreated"));
            setTitle("");
            setIsCreating(false);
            router.refresh();
        } catch {
            toast.error(tCommon("errors.generic"));
        } finally {
            setIsUpdating(false);
        }
    }

    const onDelete = async (id: string) => {
        try {
            setIsUpdating(true);
            await axios.delete(`/api/courses/${courseId}/chapters/${id}`);
            toast.success(t("chapterDeleted"));
            router.refresh();
        } catch {
            toast.error(tCommon("errors.generic"));
        } finally {
            setIsUpdating(false);
        }
    }

    const onReorder = async (updateData: { id: string; position: number }[]) => {
        try {
            setIsUpdating(true);
            await axios.put(`/api/courses/${courseId}/chapters/reorder`, {
                list: updateData
            });
            toast.success(t("chaptersReordered"));
            router.refresh();
        } catch {
            toast.error(tCommon("errors.generic"));
        } finally {
            setIsUpdating(false);
        }
    }

    const onEdit = (id: string) => {
        router.push(`/dashboard/teacher/courses/${courseId}/chapters/${id}`);
    }

    return (
        <div className="relative mt-6 border bg-card rounded-md p-4">
            {isUpdating && (
                <div className="absolute h-full w-full bg-background/50 top-0 right-0 rounded-m flex items-center justify-center">
                    <div className="animate-spin h-6 w-6 border-4 border-primary rounded-full border-t-transparent" />
                </div>
            )}
            <div className="font-medium flex items-center justify-between">
                {t("chaptersTitle")}
                <Button onClick={() => setIsCreating((current) => !current)} variant="ghost">
                    {isCreating ? (
                        <>{tCommon("cancel")}</>
                    ) : (
                        <>
                            <PlusCircle className="h-4 w-4 mr-2" />
                            {t("addChapter")}
                        </>
                    )}
                </Button>
            </div>
            {isCreating && (
                <div className="mt-4 space-y-4">
                    <Input
                        disabled={isUpdating}
                        placeholder={t("chapterTitlePlaceholder")}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <Button
                        onClick={onCreate}
                        disabled={!title || isUpdating}
                        type="button"
                    >
                        {tCommon("create")}
                    </Button>
                </div>
            )}
            {!isCreating && (
                <div className={cn(
                    "text-sm mt-2",
                    !initialData.chapters.length && "text-muted-foreground italic"
                )}>
                    {!initialData.chapters.length && t("noChapters")}
                    <ChaptersList
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onReorder={onReorder}
                        items={initialData.chapters || []}
                    />
                </div>
            )}
            {!isCreating && initialData.chapters.length > 0 && (
                <p className="text-xs text-muted-foreground mt-4">
                    {t("dragToReorderChapters")}
                </p>
            )}
        </div>
    );
}; 