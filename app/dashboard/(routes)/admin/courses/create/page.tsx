import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

const AdminCreateCoursePage = async () => {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/");
  }

  const t = await getTranslations("dashboard.admin.pages");

  const course = await db.course.create({
    data: {
      userId,
      title: t("untitledCourse"),
    },
  });

  // Redirect to admin course edit page
  return redirect(`/dashboard/admin/courses/${course.id}`);
};

export default AdminCreateCoursePage;
