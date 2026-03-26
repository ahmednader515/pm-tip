"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { ChevronRight, LogOut, Award } from "lucide-react";
import { CourseMobileSidebar } from "./course-mobile-sidebar";
import { UserButton } from "@/components/user-button";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";

type CertificateStatus = {
  certificateEnabled: boolean;
  totalContent: number;
  completedChapters: number;
  completedQuizzes: number;
  eligible: boolean;
};

export const CourseNavbar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ courseId?: string }>();
  const { data: session } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [status, setStatus] = useState<CertificateStatus | null>(null);

  const isChapterView = pathname?.includes("/chapters/");
  const courseId = params?.courseId;

  useEffect(() => {
    if (!courseId || !isChapterView) return;

    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/certificate-status`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setStatus(null);
          return;
        }
        const data: CertificateStatus = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setStatus(null);
      }
    };

    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [courseId, isChapterView, pathname]);

  const certificateProgress = useMemo(() => {
    if (!status || !status.certificateEnabled || status.totalContent <= 0) return 0;
    const completed = status.completedChapters + status.completedQuizzes;
    return Math.min(100, Math.round((completed / status.totalContent) * 100));
  }, [status]);

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (certificateProgress / 100) * circumference;
  const canOpenCertificates = Boolean(status?.certificateEnabled && status?.eligible);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Call logout API to end session
      await fetch("/api/auth/logout", { method: "POST" });
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleBackToDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <div className="p-4 h-full flex items-center bg-card text-foreground border-b shadow-sm">
      <div className="flex items-center">
        <CourseMobileSidebar />
        <Button
          onClick={handleBackToDashboard}
          variant="ghost"
          size="sm"
          className="flex items-center gap-x-2 hover:bg-slate-100 rtl:mr-2 ltr:ml-2"
        >
          <span className="rtl:text-right ltr:text-left">الرجوع إلى الكورسات</span>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
      <div className="flex items-center gap-x-4 rtl:mr-auto ltr:ml-auto">
        {isChapterView && status?.certificateEnabled && (
          <button
            type="button"
            onClick={() => canOpenCertificates && router.push("/dashboard/certificates")}
            disabled={!canOpenCertificates}
            className={`relative h-10 w-10 rounded-full transition ${
              canOpenCertificates ? "cursor-pointer hover:scale-105" : "cursor-default opacity-80"
            }`}
            title={
              canOpenCertificates
                ? "اكتمل التقدم - افتح صفحة الشهادات"
                : `تقدم الشهادة: ${certificateProgress}%`
            }
            aria-label={`تقدم الشهادة ${certificateProgress}%`}
          >
            <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
              <circle
                cx="20"
                cy="20"
                r={radius}
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={canOpenCertificates ? "text-emerald-600" : "text-brand"}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center">
              <Award className={`h-4 w-4 ${canOpenCertificates ? "text-emerald-600" : "text-muted-foreground"}`} />
            </span>
          </button>
        )}
        {session?.user && (
          <LoadingButton 
            size="sm" 
            variant="ghost" 
            onClick={handleLogout}
            loading={isLoggingOut}
            loadingText="جاري تسجيل الخروج..."
            className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors duration-200 ease-in-out"
          >
            <LogOut className="h-4 w-4 rtl:ml-2 ltr:mr-2"/>
            تسجيل الخروج
          </LoadingButton>
        )}
        <UserButton />
      </div>
    </div>
  );
}; 