"use client";

import * as z from "zod";
import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";

const formSchema = z.object({
    title: z.string().min(1, {
        message: "Title is required",
    }),
})

const CreatePage = () => {

    const tCommon = useTranslations("common");
    const t = useTranslations("dashboard.teacher.newCourse");
    const tCourseEditor = useTranslations("dashboard.teacher.courseEditor");
    const router = useRouter();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: ""
        },
    })

    const { isSubmitting, isValid } = form.formState;

    const { getToken } = useAuth();

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
          const token = await getToken();
      
          const response = await axios.post("/api/courses", values, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
      
          router.push(`/dashboard/teacher/courses/${response.data.id}`);
          toast.success(t("created"));
        } catch {
          toast.error(tCommon("errors.generic"));
        }
      };

    return ( 
        <div className="max-w-5xl mx-auto flex md:items-center md:justify-center h-full p-6">
            <div>
                <h1 className="text-2xl">
                    {t("pageTitle")}
                </h1>
                <p className="text-sm text-slate-600">
                    {t("pageSubtitle")}
                </p>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-8 mt-8"
                    >

                        <FormField

                            control={form.control}
                            name ="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        {tCourseEditor("courseTitleLabel")}
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            disabled={isSubmitting}
                                            placeholder={t("titlePlaceholder")}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        {t("titleHint")}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}

                        />

                        <div className="flex items-center gap-x-2">
                            <Link href="/">
                                <Button
                                    variant="ghost"
                                    type="button"
                                >
                                    {tCommon("cancel")}
                                </Button>
                            </Link>
                            <Button
                                type="submit"
                                disabled={!isValid || isSubmitting}
                            >
                                {t("continueBtn")}
                            </Button>
                        </div>

                    </form>
                </Form>
            </div>
        </div>
     );
}
 
export default CreatePage;