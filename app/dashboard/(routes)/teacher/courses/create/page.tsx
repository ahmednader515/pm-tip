import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

const CreatePage = async () => {
    const { userId } = await auth();

    if (!userId) {
        return redirect("/");
    }

    const t = await getTranslations("dashboard.teacher.pages");

    const course = await db.course.create({
        data: {
            userId,
            title: t("untitledCourse"),
        }
    });

    return redirect(`/dashboard/teacher/courses/${course.id}`);
};

export default CreatePage;
