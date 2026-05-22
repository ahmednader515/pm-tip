import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HomepageEditor } from "@/app/dashboard/(routes)/_components/homepage-editor";

export default async function TeacherHomepagePage() {
    const { userId, user } = await auth();
    if (!userId) return redirect("/");

    if (user?.role !== "TEACHER") {
        return redirect("/dashboard");
    }

    return <HomepageEditor apiBase="/api/teacher/homepage" />;
}
