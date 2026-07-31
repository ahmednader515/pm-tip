"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { CheckCircle, Circle, Award } from "lucide-react";
import axios from "axios";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { localizedField } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

interface Chapter {
  id: string;
  title: string;
  titleEn?: string | null;
  isFree: boolean;
  userProgress: {
    isCompleted: boolean;
  }[];
}

interface CourseContent {
  id: string;
  title: string;
  titleEn?: string | null;
  position: number;
  type: 'chapter' | 'quiz' | 'certificate';
  isFree?: boolean;
  isEligible?: boolean;
  userProgress?: {
    isCompleted: boolean;
  }[];
  quizResults?: {
    id: string;
    score: number;
    totalPoints: number;
    percentage: number;
  }[];
}

interface CourseSidebarProps {
  course?: {
    id: string;
    title: string;
    titleEn?: string | null;
    chapters: Chapter[];
  };
}

export const CourseSidebar = ({ course }: CourseSidebarProps) => {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const t = useTranslations("course");
  const locale = useLocale() as Locale;
  const [courseContent, setCourseContent] = useState<CourseContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState<string>("");
  const [courseRecord, setCourseRecord] = useState<Record<string, unknown> | null>(null);

  const fetchCourseData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const courseId = course?.id || params.courseId;
      if (!courseId) {
        throw new Error("Course ID is required");
      }
      const [contentResponse, courseResponse] = await Promise.all([
        axios.get(`/api/courses/${courseId}/content?t=${Date.now()}`),
        axios.get(`/api/courses/${courseId}?t=${Date.now()}`)
      ]);
      setCourseContent(contentResponse.data);
      setCourseTitle(courseResponse.data.title);
      setCourseRecord(courseResponse.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to load course data");
    } finally {
      setLoading(false);
    }
  }, [course?.id, params.courseId]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData, pathname]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  useEffect(() => {
    const currentContentId = pathname?.split("/").pop();
    setSelectedContentId(currentContentId || null);
  }, [pathname]);

  const onClick = (content: CourseContent) => {
    const courseId = course?.id || params.courseId;
    if (courseId) {
      setSelectedContentId(content.id);
      if (content.type === 'chapter') {
        router.push(`/courses/${courseId}/chapters/${content.id}`);
      } else if (content.type === 'quiz') {
        router.push(`/courses/${courseId}/quizzes/${content.id}`);
      } else if (content.type === 'certificate') {
        router.push(`/courses/${courseId}/certificate`);
      }
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="h-full border-r flex flex-col overflow-y-auto shadow-lg">
        <div className="p-8 flex flex-col border-b">
          <h1 className="font-semibold">{t("loadingCourse")}</h1>
        </div>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full border-l flex flex-col overflow-y-auto shadow-lg w-64 md:w-80">
        <div className="p-8 flex flex-col border-b">
          <h1 className="font-semibold">{t("errorOccurred")}</h1>
        </div>
        <div className="flex items-center justify-center h-full text-red-500">
          {error}
        </div>
      </div>
    );
  }

  const displayTitle = courseRecord
    ? localizedField(courseRecord, "title", locale)
    : course
      ? localizedField(course as unknown as Record<string, unknown>, "title", locale)
      : courseTitle;

  return (
    <div className="h-full border-l flex flex-col overflow-y-auto shadow-lg w-72 md:w-80">
      <div className="p-8 flex flex-col border-b">
        <h1 className="font-semibold">{displayTitle}</h1>
      </div>
      <div className="flex flex-col w-full">
        {courseContent.map((content) => {
          const isSelected = selectedContentId === content.id;
          const isCompleted = content.type === 'chapter' 
            ? content.userProgress?.[0]?.isCompleted || false
            : content.type === 'quiz'
            ? Boolean(content.quizResults && content.quizResults.length > 0)
            : Boolean(content.isEligible);
          
          return (
            <div
              key={content.id}
              className={cn(
                "flex items-center gap-x-2 text-sm font-[500] rtl:pr-4 ltr:pl-4 py-4 transition cursor-pointer",
                isSelected 
                  ? "bg-slate-200 text-slate-900"
                  : "text-slate-500 hover:bg-slate-300/20 hover:text-slate-600",
                isCompleted && !isSelected && "text-emerald-600"
              )}
              onClick={() => onClick(content)}
            >
              {content.type === "certificate" ? (
                <Award className={cn("h-4 w-4", isCompleted ? "text-emerald-600" : "")} />
              ) : isCompleted ? (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
              <span className="rtl:text-right ltr:text-left flex-grow mr-1">
                {localizedField(content as unknown as Record<string, unknown>, "title", locale)}
                {content.type === 'quiz' && (
                  <span className="ml-2 text-xs text-green-600">{t("quizLabel")}</span>
                )}
                {content.type === 'certificate' && (
                  <span className="ml-2 text-xs text-brand">{t("certificateLabel")}</span>
                )}
              </span>
              {content.type === 'chapter' && content.isFree && (
                <span className="ml-4 px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                  {t("free")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
