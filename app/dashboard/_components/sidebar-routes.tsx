"use client";

import { BarChart, Compass, Layout, List, Wallet, Shield, Users, Eye, TrendingUp, BookOpen, FileText, Award, Key, Ticket, CalendarCheck, ShoppingBag, Home, MessageCircle } from "lucide-react";
import { SidebarItem } from "./sidebar-item";
import { usePathname } from "next/navigation";
import { useQuestionBankSettings } from "@/components/question-bank-settings-provider";
import { useLocale, useTranslations } from "next-intl";
import { localizedField } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

export const SidebarRoutes = ({ closeOnClick = false }: { closeOnClick?: boolean }) => {
    const pathName = usePathname();
    const questionBankSettings = useQuestionBankSettings();
    const locale = useLocale() as Locale;
    const displayName = localizedField(questionBankSettings as unknown as Record<string, unknown>, "displayName", locale);
    const tStudent = useTranslations("dashboard.student.sidebar");
    const tTeacher = useTranslations("dashboard.teacher.sidebar");
    const tAdmin = useTranslations("dashboard.admin.sidebar");

    const isTeacherPage = pathName?.includes("/dashboard/teacher");
    const isAdminPage = pathName?.includes("/dashboard/admin");

    const guestRoutes = [
        { icon: Layout, label: tStudent("dashboard"), href: "/dashboard" },
        { icon: Compass, label: tStudent("courses"), href: "/dashboard/search" },
        { icon: ShoppingBag, label: tStudent("store"), href: "/dashboard/store" },
        { icon: CalendarCheck, label: tStudent("subscriptions"), href: "/dashboard/subscriptions" },
        { icon: Wallet, label: tStudent("balance"), href: "/dashboard/balance" },
        { icon: FileText, label: tStudent("quizzes"), href: "/dashboard/quizzes" },
        { icon: MessageCircle, label: displayName || tStudent("questionBank"), href: "/dashboard/question-bank", dynamicLabel: true },
        { icon: Award, label: tStudent("certificates"), href: "/dashboard/certificates" },
    ];

    const teacherRoutes = [
        { icon: List, label: tTeacher("courses"), href: "/dashboard/teacher/courses" },
        { icon: CalendarCheck, label: tTeacher("subscriptions"), href: "/dashboard/teacher/subscriptions" },
        { icon: FileText, label: tTeacher("quizzes"), href: "/dashboard/teacher/quizzes" },
        { icon: MessageCircle, label: tTeacher("questionBank"), href: "/dashboard/teacher/question-bank" },
        { icon: Award, label: tTeacher("grades"), href: "/dashboard/teacher/grades" },
        { icon: BarChart, label: tTeacher("analytics"), href: "/dashboard/teacher/analytics" },
        { icon: Users, label: tTeacher("users"), href: "/dashboard/teacher/users" },
        { icon: Wallet, label: tTeacher("balances"), href: "/dashboard/teacher/balances" },
        { icon: BookOpen, label: tTeacher("addCourses"), href: "/dashboard/teacher/add-courses" },
        { icon: Key, label: tTeacher("passwords"), href: "/dashboard/teacher/passwords" },
        { icon: Ticket, label: tTeacher("codes"), href: "/dashboard/teacher/codes" },
        { icon: ShoppingBag, label: tTeacher("store"), href: "/dashboard/teacher/store" },
        { icon: Home, label: tTeacher("homepage"), href: "/dashboard/teacher/homepage" },
        { icon: Shield, label: tTeacher("createAccount"), href: "/dashboard/teacher/create-account" },
    ];

    const adminRoutes = [
        { icon: Users, label: tAdmin("users"), href: "/dashboard/admin/users" },
        { icon: List, label: tAdmin("courses"), href: "/dashboard/admin/courses" },
        { icon: FileText, label: tAdmin("quizzes"), href: "/dashboard/admin/quizzes" },
        { icon: MessageCircle, label: tAdmin("questionBank"), href: "/dashboard/admin/question-bank" },
        { icon: Shield, label: tAdmin("createAccount"), href: "/dashboard/admin/create-account" },
        { icon: Eye, label: tAdmin("passwords"), href: "/dashboard/admin/passwords" },
        { icon: Wallet, label: tAdmin("balances"), href: "/dashboard/admin/balances" },
        { icon: TrendingUp, label: tAdmin("progress"), href: "/dashboard/admin/progress" },
        { icon: BookOpen, label: tAdmin("addCourses"), href: "/dashboard/admin/add-courses" },
        { icon: Ticket, label: tAdmin("codes"), href: "/dashboard/admin/codes" },
        { icon: ShoppingBag, label: tAdmin("store"), href: "/dashboard/admin/store" },
        { icon: Home, label: tAdmin("homepage"), href: "/dashboard/admin/homepage" },
    ];

    const routes = isAdminPage ? adminRoutes : isTeacherPage ? teacherRoutes : guestRoutes;

    return (
        <div className="flex flex-col w-full pt-0">
            {routes.map((route) => (
                <SidebarItem
                  key={route.href}
                  icon={route.icon}
                  label={route.label}
                  href={route.href}
                  closeOnClick={closeOnClick}
                />
            ))}
        </div>
    );
}
