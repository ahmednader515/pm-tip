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
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Course } from "@prisma/client";

interface DescriptionFormProps {
    initialData: Course;

    courseId: string;
}

const formSchema = z.object({
    description: z.string().min(1, {
        message: "Description is required",
    }),
    descriptionEn: z.string().optional(),
});

export const DescriptionForm = ({
    initialData,
    courseId
}: DescriptionFormProps) => {
    const tCommon = useTranslations("common");
    const tEditor = useTranslations("editor");
    const tCourseEditor = useTranslations("dashboard.teacher.courseEditor");
    const [isEditing, setIsEditing] = useState(false);

    const toggleEdit = () => setIsEditing((current) => !current);

    const router = useRouter();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            description: initialData?.description || "",
            descriptionEn: initialData?.descriptionEn || "",
        }
    });

    const { isSubmitting, isValid } = form.formState;

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            await axios.patch(`/api/courses/${courseId}`, {
                description: values.description,
                descriptionEn: values.descriptionEn?.trim() || null,
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
                {tCommon("description")}
                <Button onClick={toggleEdit} variant="ghost">
                    {isEditing && (<>{tCommon("cancel")}</>)}
                    {!isEditing && (
                    <>
                        <Pencil className="h-4 w-4 mr-2" />
                        {tCourseEditor("editDescriptionAction")}
                    </>)}
                </Button>
            </div>
            {!isEditing && (
                <div className="space-y-1 mt-2">
                    <p className={cn(
                        "text-sm text-muted-foreground",
                        !initialData.description && "italic"
                    )}>
                        {initialData.description || tCourseEditor("noDescriptionShort")}
                    </p>
                    {initialData.descriptionEn && (
                        <p dir="ltr" className="text-xs text-muted-foreground">
                            {initialData.descriptionEn}
                        </p>
                    )}
                </div>
            )}

            {isEditing && (
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                        <FormField 
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{tCommon("arabicLabel")}</FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            disabled={isSubmitting}
                                            placeholder={tCourseEditor("descriptionPlaceholder")}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField 
                            control={form.control}
                            name="descriptionEn"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{tCommon("englishLabel")} — {tEditor("descriptionEn")}</FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            disabled={isSubmitting}
                                            dir="ltr"
                                            placeholder={tCourseEditor("descriptionPlaceholderEn")}
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
