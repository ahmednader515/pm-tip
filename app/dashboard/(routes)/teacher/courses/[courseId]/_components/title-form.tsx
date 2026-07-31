"use client"

import * as z from "zod";
import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface TitleFormProps {
    initialData: {
        title: string;
        titleEn?: string | null;
    };

    courseId: string;
}

const formSchema = z.object({
    title: z.string().min(1, {
        message: "Title is required",
    }),
    titleEn: z.string().optional(),
});

export const TitleForm = ({
    initialData,
    courseId
}: TitleFormProps) => {
    const tCommon = useTranslations("common");
    const tEditor = useTranslations("editor");
    const tCourseEditor = useTranslations("dashboard.teacher.courseEditor");
    const [isEditing, setIsEditing] = useState(false);

    const toggleEdit = () => setIsEditing((current) => !current);

    const router = useRouter();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: initialData.title || "",
            titleEn: initialData.titleEn || "",
        },
    });

    const { isSubmitting, isValid } = form.formState;

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            await axios.patch(`/api/courses/${courseId}`, {
                title: values.title,
                titleEn: values.titleEn?.trim() || null,
            });
            toast.success(tCourseEditor("courseUpdated"));
            toggleEdit();
            router.refresh();
        } catch {
            toast.error(tCommon("errors.generic"));
        }
    }

    return (
        <div className="mt-6 border bg-card rounded-md p-4">
            <div className="font-medium flex items-center justify-between">
                {tCourseEditor("courseTitleLabel")}
                <Button onClick={toggleEdit} variant="ghost">
                    {isEditing && (<>{tCommon("cancel")}</>)}
                    {!isEditing && (
                    <>
                        <Pencil className="h-4 w-4 mr-2" />
                        {tCourseEditor("editTitleAction")}
                    </>)}
                </Button>
            </div>
            {!isEditing && (
                <div className="text-sm mt-2 text-muted-foreground space-y-1">
                    <p>{initialData.title}</p>
                    {initialData.titleEn && (
                        <p dir="ltr" className="text-xs">{initialData.titleEn}</p>
                    )}
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
                                    <FormLabel>{tCommon("arabicLabel")}</FormLabel>
                                    <FormControl>
                                        <Input 
                                            disabled={isSubmitting}
                                            placeholder={tCourseEditor("titlePlaceholder")}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField 
                            control={form.control}
                            name="titleEn"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{tCommon("englishLabel")} — {tEditor("titleEn")}</FormLabel>
                                    <FormControl>
                                        <Input 
                                            disabled={isSubmitting}
                                            dir="ltr"
                                            placeholder={tCourseEditor("titlePlaceholderEn")}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex items-center gap-x-2">
                            <Button disabled={!isValid || isSubmitting} type="submit">
                                {tCommon("save")}
                            </Button>
                        </div>
                    </form>
                </Form>
            )}
        </div>
    )
}
