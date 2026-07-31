"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function AdminRedirect() {
    const router = useRouter();
    const t = useTranslations("dashboard.admin.pages");

    useEffect(() => {
        router.replace("/dashboard/admin/users");
    }, [router]);

    return (
        <div className="h-full flex items-center justify-center">
            <div className="text-center">
                <div className="text-lg">{t("redirecting")}</div>
            </div>
        </div>
    );
}
