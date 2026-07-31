import { Course, Chapter, User } from "@prisma/client";
import { CourseCard } from "@/components/course-card";
import { getTranslations, getLocale } from "next-intl/server";
import { localizedField } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

interface CoursesListProps {
    items: (Course & {
        chapters: Chapter[];
        user: User;
    })[];
}

export const CoursesList = async ({
    items
}: CoursesListProps) => {
    const t = await getTranslations("dashboard.student.search");
    const locale = (await getLocale()) as Locale;

    return (
        <div>
            <div className="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
                {items.map((item) => (
                    <CourseCard
                        key={item.id}
                        id={item.id}
                        title={localizedField(item as Record<string, unknown>, "title", locale)}
                        imageUrl={item.imageUrl!}
                        chaptersLength={item.chapters.length}
                        price={item.price!}
                        progress={null}
                        user={{
                            name: item.user.fullName,
                            image: item.user.image || "/male.png"
                        }}
                    />
                ))}
            </div>
            {items.length === 0 && (
                <div className="text-center text-sm text-muted-foreground mt-10">
                    {t("noCourses")}
                </div>
            )}
        </div>
    );
};
