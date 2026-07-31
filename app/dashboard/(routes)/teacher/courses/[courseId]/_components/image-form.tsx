"use client"

import axios from "axios";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ImageIcon, Pencil, PlusCircle } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Course } from "@prisma/client";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { FileUpload } from "@/components/file-upload";

interface ImageFormProps {
    initialData: Course;
    courseId: string;
}

export const ImageForm = ({
    initialData,
    courseId
}: ImageFormProps) => {

    const tCommon = useTranslations("common");
    const t = useTranslations("dashboard.teacher.courseEditor");
    const [isEditing, setIsEditing] = useState(false);

    const toggleEdit = () => setIsEditing((current) => !current);

    const router = useRouter();

    const onSubmit = async (values: { imageUrl: string }) => {
        try {
            await axios.patch(`/api/courses/${courseId}`, values);
            toast.success(t("courseUpdated"));
            toggleEdit();
            router.refresh();
        } catch {
            toast.error(tCommon("errors.generic"));
        }
    }

    return (
        <div className="mt-6 border bg-card rounded-md p-4">
            <div className="font-medium flex items-center justify-between">
                {t("courseImageTitle")}
                <Button onClick={toggleEdit} variant="ghost">
                    {isEditing && (<>{tCommon("cancel")}</>)}
                    {!isEditing && !initialData.imageUrl && (
                        <>
                            <PlusCircle className="h-4 w-4 mr-2"/>
                            {t("addImageAction")}
                        </>
                    )}
                    {!isEditing && initialData.imageUrl && (
                    <>
                        <Pencil className="h-4 w-4 mr-2" />
                        {t("editImageAction")}
                    </>)}
                </Button>
            </div>
            {!isEditing && (
                !initialData.imageUrl ? (
                    <div className="flex items-center justify-center h-60 bg-muted rounded-md">
                        <ImageIcon className="h-10 w-10 text-muted-foreground" />
                    </div>
                ) : (
                    <div className="relative aspect-video mt-2">
                        <Image
                            alt="Upload"
                            fill
                            className="object-cover rounded-md"
                            src={initialData.imageUrl}
                        />
                    </div>
                )
            )}

            {isEditing && (
                <div>
                    <FileUpload
                        endpoint="courseImage"
                        onChange={(res) => {
                            if (res) {
                                onSubmit({ imageUrl: res.url })
                            }
                        }}
                    />

                    <div className="text-xs text-muted-foreground mt-4">
                        {t("aspectRatioHint")}
                    </div>
                </div>
            )}
        </div>
    )
}