import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        const resolvedParams = await params;
        const { userId } = await auth();
        const { courseId } = resolvedParams;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const course = await db.course.findUnique({
            where: {
                id: courseId,
                isPublished: true,
            },
            include: {
                chapters: {
                    where: {
                        isPublished: true,
                    },
                    orderBy: {
                        position: "asc",
                    },
                },
                attachments: {
                    orderBy: {
                        createdAt: "desc",
                    },
                },
                purchases: {
                    where: {
                        userId,
                    },
                },
            },
        });

        if (!course) {
            return new NextResponse("Not found", { status: 404 });
        }

        return NextResponse.json(course);
    } catch (error) {
        console.error("[COURSE_ID]", error);
        if (error instanceof Error) {
            return new NextResponse(`Internal Error: ${error.message}`, { status: 500 });
        }
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        const { userId, user } = await auth();
        const resolvedParams = await params;
        const values = await req.json();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const allowed: Record<string, unknown> = {};
        const keys = [
            "title",
            "titleEn",
            "description",
            "descriptionEn",
            "imageUrl",
            "price",
            "isPublished",
            "certificateEnabled",
        ] as const;
        for (const key of keys) {
            if (values[key] !== undefined) {
                if (key === "titleEn" || key === "descriptionEn") {
                    const v = values[key];
                    allowed[key] = v == null || String(v).trim() === "" ? null : String(v);
                } else {
                    allowed[key] = values[key];
                }
            }
        }

        if (Object.keys(allowed).length === 0) {
            return new NextResponse("No fields to update", { status: 400 });
        }

        const whereClause = user?.role === "ADMIN"
            ? { id: resolvedParams.courseId }
            : { id: resolvedParams.courseId, userId };

        const course = await db.course.update({
            where: whereClause,
            data: allowed,
        });

        return NextResponse.json(course);
    } catch (error) {
        console.log("[COURSE_ID]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        const { userId, user } = await auth();
        const resolvedParams = await params;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const course = await db.course.findUnique({
            where: {
                id: resolvedParams.courseId,
            }
        });

        if (!course) {
            return new NextResponse("Not found", { status: 404 });
        }

        // Only owner or admin can delete
        if (user?.role !== "ADMIN" && course.userId !== userId) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const deletedCourse = await db.course.delete({
            where: {
                id: resolvedParams.courseId,
            },
        });

        return NextResponse.json(deletedCourse);
    } catch (error) {
        console.log("[COURSE_ID_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}