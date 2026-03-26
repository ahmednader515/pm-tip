"use client";

import { BarChart, Compass, Layout, List, Wallet, Shield, Users, Eye, TrendingUp, BookOpen, FileText, Award, PlusSquare, Key, Ticket, CalendarCheck } from "lucide-react";
import { SidebarItem } from "./sidebar-item";
import { usePathname } from "next/navigation";

const guestRoutes = [
    {
        icon: Layout,
        label: "لوحة التحكم",
        href: "/dashboard",
    },
    {
        icon: Compass,
        label: "الكورسات",
        href: "/dashboard/search",
    },
    {
        icon: CalendarCheck,
        label: "الاشتراكات",
        href: "/dashboard/subscriptions",
    },
    {
        icon: Wallet,
        label: "الرصيد",
        href: "/dashboard/balance",
    },
    {
        icon: FileText,
        label: "الاختبارات",
        href: "/dashboard/quizzes",
    },
    {
        icon: Award,
        label: "الشهادات",
        href: "/dashboard/certificates",
    },
];

const teacherRoutes = [
    {
        icon: List,
        label: "الكورسات",
        href: "/dashboard/teacher/courses",
    },
    {
        icon: CalendarCheck,
        label: "الاشتراكات",
        href: "/dashboard/teacher/subscriptions",
    },
    {
        icon: FileText,
        label: "الاختبارات",
        href: "/dashboard/teacher/quizzes",
    },
    {
        icon: Award,
        label: "الدرجات",
        href: "/dashboard/teacher/grades",
    },
    {
        icon: BarChart,
        label: "الاحصائيات",
        href: "/dashboard/teacher/analytics",
    },
    {
        icon: Users,
        label: "إدارة الطلاب",
        href: "/dashboard/teacher/users",
    },
    {
        icon: Wallet,
        label: "إدارة الأرصدة",
        href: "/dashboard/teacher/balances",
    },
    {
        icon: BookOpen,
        label: "اضافة و حذف الكورسات",
        href: "/dashboard/teacher/add-courses",
    },
    {
        icon: Key,
        label: "كلمات المرور",
        href: "/dashboard/teacher/passwords",
    },
    {
        icon: Ticket,
        label: "الاكواد",
        href: "/dashboard/teacher/codes",
    },
    {
        icon: Shield,
        label: "إنشاء حساب طالب",
        href: "/dashboard/teacher/create-account",
    },
];

const adminRoutes = [
    {
        icon: Users,
        label: "إدارة المستخدمين",
        href: "/dashboard/admin/users",
    },
    {
        icon: List,
        label: "الكورسات",
        href: "/dashboard/admin/courses",
    },
    {
        icon: FileText,
        label: "الاختبارات",
        href: "/dashboard/admin/quizzes",
    },
    {
        icon: Shield,
        label: "إنشاء حساب طالب",
        href: "/dashboard/admin/create-account",
    },
    {
        icon: Eye,
        label: "كلمات المرور",
        href: "/dashboard/admin/passwords",
    },
    {
        icon: Wallet,
        label: "إدارة الأرصدة",
        href: "/dashboard/admin/balances",
    },
    {
        icon: TrendingUp,
        label: "تقدم الطلاب",
        href: "/dashboard/admin/progress",
    },
    {
        icon: BookOpen,
        label: "اضافة و حذف الكورسات",
        href: "/dashboard/admin/add-courses",
    },
    {
        icon: Ticket,
        label: "الاكواد",
        href: "/dashboard/admin/codes",
    },
];

export const SidebarRoutes = ({ closeOnClick = false }: { closeOnClick?: boolean }) => {
    const pathName = usePathname();

    const isTeacherPage = pathName?.includes("/dashboard/teacher");
    const isAdminPage = pathName?.includes("/dashboard/admin");
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