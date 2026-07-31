"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Course } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import toast from "react-hot-toast";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Pencil, Globe } from "lucide-react";
import { useTranslations } from "next-intl";

const formSchema = z.object({
    title: z.string().min(1, {
        message: "Title is required",
    }),
    description: z.string().min(1, {
        message: "Description is required",
    }),
});

interface CourseFormProps {
    initialData: Course;
    courseId: string;
}

export const CourseForm = ({
    initialData,
    courseId
}: CourseFormProps) => {
    const router = useRouter();
    const tCommon = useTranslations("common");
    const tPages = useTranslations("dashboard.teacher.pages");
    const t = useTranslations("dashboard.teacher.courseEditor");
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: initialData.title || "",
            description: initialData.description || "",
        },
    });

    const toggleEdit = () => setIsEditing((current) => !current);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setIsLoading(true);
            await axios.patch(`/api/courses/${courseId}`, values);
            toast.success(t("courseUpdated"));
            toggleEdit();
            router.refresh();
        } catch {
            toast.error(tCommon("errors.generic"));
        } finally {
            setIsLoading(false);
        }
    }

    const onPublish = async () => {
        try {
            setIsLoading(true);
            await axios.patch(`/api/courses/${courseId}/publish`);
            toast.success(initialData.isPublished ? tPages("unpublishSuccess") : tPages("publishSuccess"));
            router.refresh();
        } catch {
            toast.error(tCommon("errors.generic"));
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="mt-6 border bg-slate-100 rounded-md p-4">
            <div className="font-medium flex items-center justify-between">
                {t("courseSettings")}
                <Button onClick={toggleEdit} variant="ghost">
                    {isEditing ? (
                        <>{tCommon("cancel")}</>
                    ) : (
                        <>
                            <Pencil className="h-4 w-4 mr-2" />
                            {tCommon("edit")} {tCommon("course")}
                        </>
                    )}
                </Button>
            </div>
            {!isEditing && (
                <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        {initialData.isPublished ? tCommon("published") : tCommon("draft")}
                    </p>
                    <Button
                        onClick={onPublish}
                        disabled={isLoading}
                        variant={initialData.isPublished ? "destructive" : "default"}
                    >
                        <Globe className="h-4 w-4 mr-2" />
                        {initialData.isPublished ? tCommon("unpublish") : tCommon("publish")}
                    </Button>
                </div>
            )}
            {isEditing && (
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            disabled={isLoading}
                                            placeholder={t("titlePlaceholder")}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{tCommon("description")}</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            disabled={isLoading}
                                            placeholder={t("descriptionPlaceholder")}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex items-center gap-x-2">
                            <Button
                                disabled={isLoading}
                                type="submit"
                            >
                                {tCommon("save")}
                            </Button>
                        </div>
                    </form>
                </Form>
            )}
        </div>
    )
} 