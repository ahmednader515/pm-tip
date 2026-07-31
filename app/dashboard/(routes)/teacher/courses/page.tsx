import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CoursesTable } from "./_components/courses-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getTranslations } from "next-intl/server";

const CoursesPage = async () => {
    const { userId } = await auth();

    if (!userId) {
        return redirect("/");
    }

    const t = await getTranslations("dashboard.teacher.pages");

    const courses = await db.course.findMany({
        where: {
            userId,
        },
        include: {
            chapters: {
                select: {
                    id: true,
                    isPublished: true,
                }
            },
            quizzes: {
                select: {
                    id: true,
                    isPublished: true,
                }
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    }).then(courses => courses.map(course => ({
        ...course,
        price: course.price || 0,
        publishedChaptersCount: course.chapters.filter(ch => ch.isPublished).length,
        publishedQuizzesCount: course.quizzes.filter(q => q.isPublished).length,
    })));

    const unpublishedCourses = courses.filter(course => !course.isPublished);
    const hasUnpublishedCourses = unpublishedCourses.length > 0;

    return (
        <div className="p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{t("coursesTitle")}</h1>
                <Link href="/dashboard/teacher/courses/create">
                    <Button className="bg-brand hover:bg-brand/90 text-white">
                        <PlusCircle className="h-4 w-4 mr-2" />
                        {t("createCourse")}
                    </Button>
                </Link>
            </div>

            {hasUnpublishedCourses && (
                <Alert className="mt-6 border-orange-200 bg-orange-50">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                        <div className="mb-2">
                            <strong>{t("publishChecklistTitle")}</strong>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>{t("publishCheckTitle")}</li>
                            <li>{t("publishCheckDesc")}</li>
                            <li>{t("publishCheckImage")}</li>
                            <li>{t("publishCheckChapter")}</li>
                            <li>{t("publishCheckButton")}</li>
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            <div className="mt-6">
                <CoursesTable data={courses} />
            </div>
        </div>
    );
};

export default CoursesPage;
