import { IconBadge } from "@/components/icon-badge";
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { LayoutDashboard } from "lucide-react";
import { redirect } from "next/navigation";
import { TitleForm } from "@/app/dashboard/(routes)/teacher/courses/[courseId]/_components/title-form";
import { DescriptionForm } from "@/app/dashboard/(routes)/teacher/courses/[courseId]/_components/description-form";
import { ImageForm } from "@/app/dashboard/(routes)/teacher/courses/[courseId]/_components/image-form";
import { PriceForm } from "@/app/dashboard/(routes)/teacher/courses/[courseId]/_components/price-form";
import { CourseContentForm } from "@/app/dashboard/(routes)/teacher/courses/[courseId]/_components/course-content-form";
import { Banner } from "@/components/banner";
import { Actions } from "@/app/dashboard/(routes)/teacher/courses/[courseId]/_components/actions";

export default async function AdminCourseIdPage({
    params,
}: {
    params: Promise<{ courseId: string }>
}) {
    const resolvedParams = await params;
    const { courseId } = resolvedParams;

    const { userId, user } = await auth();

    if (!userId) {
        return redirect("/");
    }

    // Only admin can access this route
    if (user?.role !== "ADMIN") {
        return redirect("/dashboard");
    }

    const course = await db.course.findUnique({
        where: {
            id: courseId,
        },
        include: {
            chapters: {
                orderBy: {
                    position: "asc",
                },
            },
            quizzes: {
                orderBy: {
                    position: "asc",
                },
            },
        }
    });

    if (!course) {
        return redirect("/dashboard/admin/courses");
    }

    const requiredFields = [
        course.title,
        course.description,
        course.imageUrl,
        course.price,
        course.chapters.some(chapter => chapter.isPublished)
    ];

    const totalFields = requiredFields.length;
    const completedFields = requiredFields.filter(Boolean).length;

    const completionText = `(${completedFields}/${totalFields})`;

    const isComplete = requiredFields.every(Boolean);

    // Create detailed completion status
    const completionStatus = {
        title: !!course.title,
        description: !!course.description,
        imageUrl: !!course.imageUrl,
        price: course.price !== null && course.price !== undefined,
        publishedChapters: course.chapters.some(chapter => chapter.isPublished)
    };

    return (
        <>
            {!course.isPublished && (
                <Banner
                    variant="warning"
                    label="هذه الكورس غير منشورة. لن تكون مرئية للطلاب."
                />
            )}
            <div className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-y-2">
                        <h1 className="text-2xl font-medium">
                            إعداد الكورس
                        </h1>
                        <span className="text-sm text-slate-700">
                            أكمل جميع الحقول {completionText}
                        </span>
                        {!isComplete && (
                            <div className="text-xs text-muted-foreground mt-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className={`flex items-center gap-1 ${completionStatus.title ? 'text-brand' : 'text-red-600'}`}>
                                        <span>{completionStatus.title ? '✓' : '✗'}</span>
                                        <span>العنوان</span>
                                    </div>
                                    <div className={`flex items-center gap-1 ${completionStatus.description ? 'text-brand' : 'text-red-600'}`}>
                                        <span>{completionStatus.description ? '✓' : '✗'}</span>
                                        <span>الوصف</span>
                                    </div>
                                    <div className={`flex items-center gap-1 ${completionStatus.imageUrl ? 'text-brand' : 'text-red-600'}`}>
                                        <span>{completionStatus.imageUrl ? '✓' : '✗'}</span>
                                        <span>الصورة</span>
                                    </div>
                                    <div className={`flex items-center gap-1 ${completionStatus.price ? 'text-brand' : 'text-red-600'}`}>
                                        <span>{completionStatus.price ? '✓' : '✗'}</span>
                                        <span>السعر</span>
                                    </div>
                                    <div className={`flex items-center gap-1 ${completionStatus.publishedChapters ? 'text-brand' : 'text-red-600'}`}>
                                        <span>{completionStatus.publishedChapters ? '✓' : '✗'}</span>
                                        <span>فصل منشور</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <Actions
                        disabled={!isComplete}
                        courseId={courseId}
                        isPublished={course.isPublished}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
                    <div>
                        <div className="flex items-center gap-x-2">
                            <IconBadge icon={LayoutDashboard} />
                            <h2 className="text-xl">
                                تخصيص دورتك
                            </h2>
                        </div>
                        <TitleForm
                            initialData={course}
                            courseId={course.id}
                        />
                        <DescriptionForm
                            initialData={course}
                            courseId={course.id}
                        />
                        <PriceForm
                            initialData={course}
                            courseId={course.id}
                        />
                    </div>
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center gap-x-2">
                                <IconBadge icon={LayoutDashboard} />
                                <h2 className="text-xl">
                                    الموارد والفصول
                                </h2>
                            </div>
                            <CourseContentForm
                                initialData={course}
                                courseId={course.id}
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-x-2">
                                <IconBadge icon={LayoutDashboard} />
                                <h2 className="text-xl">
                                    إعدادات الكورس
                                </h2>
                            </div>
                            <ImageForm
                                initialData={course}
                                courseId={course.id}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

