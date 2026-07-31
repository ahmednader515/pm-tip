"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Info } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActionsProps {
    disabled: boolean;
    courseId: string;
    isPublished: boolean;
}

export const Actions = ({
    disabled,
    courseId,
    isPublished,
}: ActionsProps) => {
    const router = useRouter();
    const tCommon = useTranslations("common");
    const tPages = useTranslations("dashboard.teacher.pages");
    const t = useTranslations("dashboard.teacher.courseEditor");
    const [isLoading, setIsLoading] = useState(false);

    const onClick = async () => {
        try {
            setIsLoading(true);

            if (isPublished) {
                await axios.patch(`/api/courses/${courseId}/unpublish`);
                toast.success(tPages("unpublishSuccess"));
            } else {
                await axios.patch(`/api/courses/${courseId}/publish`);
                toast.success(t("coursePublished"));
            }

            router.refresh();
        } catch {
            toast.error(tCommon("errors.generic"));
        } finally {
            setIsLoading(false);
        }
    }

    const publishButton = (
        <Button
            onClick={onClick}
            disabled={disabled || isLoading}
            className="bg-brand hover:bg-brand/90 text-white"
            size="sm"
        >
            {isPublished ? (
                <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    {tCommon("unpublish")}
                </>
            ) : (
                <>
                    <Eye className="h-4 w-4 mr-2" />
                    {t("publishCourseAction")}
                </>
            )}
        </Button>
    );

    return (
        <div className="flex items-center gap-x-2">
            {disabled && !isPublished ? (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="relative">
                                {publishButton}
                                <Info className="h-4 w-4 absolute -top-1 -right-1 text-orange-500" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                            <div className="text-sm">
                                <p className="font-semibold mb-2">{t("cannotPublishUntil")}</p>
                                <ul className="space-y-1 text-xs">
                                    <li>• {tPages("publishCheckTitle")}</li>
                                    <li>• {tPages("publishCheckDesc")}</li>
                                    <li>• {tPages("publishCheckImage")}</li>
                                    <li>• {t("publishReqPrice")}</li>
                                    <li>• {tPages("publishCheckChapter")}</li>
                                </ul>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ) : (
                publishButton
            )}
        </div>
    )
} 