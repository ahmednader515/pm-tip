import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getAccessibleCourseIds } from "@/lib/course-access";
import { SearchInput } from "./_components/search-input";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, Users, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Course, Purchase } from "@prisma/client";

type CourseWithDetails = Course & {
    chapters: { id: string }[];
    purchases: Purchase[];
    progress: number;
    hasAccess: boolean;
}

export default async function SearchPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return redirect("/");
    }

    const resolvedParams = await searchParams;
    const title = typeof resolvedParams.title === 'string' ? resolvedParams.title : '';

    const courses = await db.course.findMany({
        where: {
            isPublished: true,
            title: {
                contains: title,
            }
        },
        include: {
            chapters: {
                where: {
                    isPublished: true,
                },
                select: {
                    id: true,
                }
            },
            purchases: {
                where: {
                    userId: session.user.id,
                }
            }
        },
        orderBy: {
            createdAt: "desc",
        }
    ,
        cacheStrategy: process.env.NODE_ENV === "production" ? { ttl: 60 } : undefined,
    });

    const accessibleIds = await getAccessibleCourseIds(session.user.id);

    const coursesWithProgress = await Promise.all(
        courses.map(async (course) => {
            const totalChapters = course.chapters.length;
            const completedChapters = await db.userProgress.count({
                where: {
                    userId: session.user.id,
                    chapterId: {
                        in: course.chapters.map(chapter => chapter.id)
                    },
                    isCompleted: true
                }
            });

            const progress = totalChapters > 0 
                ? (completedChapters / totalChapters) * 100 
                : 0;
            const hasAccess = course.price === 0 || course.price === null || accessibleIds.has(course.id);

            return {
                ...course,
                progress,
                hasAccess
            } as CourseWithDetails;
        })
    );

    return (
        <div className="p-6 space-y-6">
            {/* Header Section */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">البحث عن الكورسات</h1>
                <p className="text-muted-foreground text-lg">
                    {title 
                        ? `نتائج البحث عن "${title}"`
                        : "اكتشف مجموعة متنوعة من الكورسات التعليمية المميزة"
                    }
                </p>
            </div>

            {/* Search Input Section */}
            <div className="bg-card rounded-2xl p-6 border shadow-sm">
                <div className="max-w-2xl mx-auto">
                    <SearchInput />
                </div>
            </div>

            {/* Results Section */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">
                        {title ? `نتائج البحث (${coursesWithProgress.length})` : `جميع الكورسات (${coursesWithProgress.length})`}
                    </h2>
                    {coursesWithProgress.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                            {coursesWithProgress.length} كورس متاح
                        </div>
                    )}
                </div>

                {/* Course Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {coursesWithProgress.map((course) => (
                        <div
                            key={course.id}
                            className="group bg-card rounded-2xl overflow-hidden border shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                        >
                            <div className="relative w-full aspect-[16/9]">
                                <Image
                                    src={course.imageUrl || "/placeholder.png"}
                                    alt={course.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                
                                {/* Course Status Badge */}
                                <div className="absolute top-4 right-4">
                                    <div className={`rounded-full px-3 py-1 text-sm font-medium ${
                                        course.purchases.length > 0 && course.hasAccess
                                            ? "bg-green-500 text-white"
                                            : course.purchases.length > 0 && !course.hasAccess
                                            ? "bg-amber-500 text-white"
                                            : "bg-white/90 backdrop-blur-sm text-gray-800"
                                    }`}>
                                        {course.purchases.length > 0 && course.hasAccess
                                            ? "مشترك"
                                            : course.purchases.length > 0 && !course.hasAccess
                                            ? "اشتراك منتهي"
                                            : "متاح"}
                                    </div>
                                </div>

                                {/* Price Badge */}
                                <div className="absolute top-4 left-4">
                                    <div className={`rounded-full px-3 py-1 text-sm font-medium ${
                                        course.price === 0 
                                            ? "bg-green-500 text-white" 
                                            : "bg-white/90 backdrop-blur-sm text-gray-800"
                                    }`}>
                                        {course.price === 0 ? "مجاني" : `${course.price} جنيه`}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6">
                                <div className="mb-4">
                                    <h3 className="text-xl font-bold mb-3 line-clamp-2 min-h-[3rem] text-gray-900">
                                        {course.title}
                                    </h3>
                                    
                                    {/* Course Stats */}
                                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                                        <div className="flex items-center gap-1">
                                            <BookOpen className="h-4 w-4" />
                                            <span className="whitespace-nowrap">
                                                {course.chapters.length} {course.chapters.length === 1 ? "فصل" : "فصول"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Users className="h-4 w-4" />
                                            <span className="whitespace-nowrap">{course.purchases.length} طالب</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-4 w-4" />
                                            <span className="whitespace-nowrap">{new Date(course.updatedAt).toLocaleDateString('ar', {
                                                year: 'numeric',
                                                month: 'short'
                                            })}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {course.purchases.length > 0 && !course.hasAccess ? (
                                    <>
                                        <p className="text-sm text-amber-600 mb-3 flex items-center gap-1">
                                            <Lock className="h-4 w-4" />
                                            انتهى اشتراكك. جدد للوصول مرة أخرى.
                                        </p>
                                        <Button
                                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 text-base"
                                            variant="default"
                                            asChild
                                        >
                                            <Link href="/dashboard/subscriptions">
                                                تجديد الاشتراك
                                            </Link>
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button 
                                            className="w-full bg-brand hover:bg-brand/90 text-white font-semibold py-3 text-base transition-all duration-200 hover:scale-105" 
                                            variant="default"
                                            asChild
                                        >
                                            <Link href={course.chapters.length > 0 ? `/courses/${course.id}/chapters/${course.chapters[0].id}` : `/courses/${course.id}`}>
                                                {course.purchases.length > 0 && course.hasAccess ? "متابعة التعلم" : "عرض الكورس"}
                                            </Link>
                                        </Button>
                                        {course.purchases.length === 0 && (
                                            <Button
                                                className="w-full mt-3 border-brand text-brand hover:bg-brand/10 font-semibold py-3 text-base transition-all duration-200"
                                                variant="outline"
                                                asChild
                                            >
                                                <Link href={`/courses/${course.id}/purchase`}>
                                                    شراء الكورس
                                                </Link>
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {coursesWithProgress.length === 0 && (
                    <div className="text-center py-16">
                        <div className="bg-muted/50 rounded-2xl p-8 max-w-md mx-auto">
                            <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">
                                {title ? "لم يتم العثور على كورسات" : "لا توجد كورسات متاحة"}
                            </h3>
                            <p className="text-muted-foreground mb-6">
                                {title 
                                    ? "جرب البحث بكلمات مختلفة أو تصفح جميع الكورسات"
                                    : "سيتم إضافة كورسات جديدة قريباً"
                                }
                            </p>
                            {title && (
                                <Button asChild className="bg-brand hover:bg-brand/90 text-white font-semibold">
                                    <Link href="/dashboard/search">
                                        عرض جميع الكورسات
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}