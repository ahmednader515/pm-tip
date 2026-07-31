"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { localizedField } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

export type Course = {
    id: string;
    title: string;
    titleEn?: string | null;
    price: number;
    isPublished: boolean;
    createdAt: Date;
}

export function useCourseColumns(): ColumnDef<Course>[] {
    const t = useTranslations("dashboard.teacher.pages");
    const tCommon = useTranslations("common");
    const locale = useLocale() as Locale;
    const dateLocale = locale === "ar" ? ar : enUS;

    return [
        {
            accessorKey: "title",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        {t("columnTitle")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                return <div>{localizedField(row.original as unknown as Record<string, unknown>, "title", locale)}</div>;
            },
        },
        {
            accessorKey: "price",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        {t("columnPrice")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const price = parseFloat(row.getValue("price"));
                return <div>{formatPrice(price)}</div>;
            },
        },
        {
            accessorKey: "isPublished",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        {t("columnStatus")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const isPublished = row.getValue("isPublished") || false;
                return (
                    <Badge variant={isPublished ? "default" : "secondary"}>
                        {isPublished ? tCommon("published") : tCommon("draft")}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "createdAt",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        {t("columnCreatedAt")}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const date = new Date(row.getValue("createdAt"));
                return <div>{format(date, "dd/MM/yyyy", { locale: dateLocale })}</div>;
            },
        }
    ];
}
