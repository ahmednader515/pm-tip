import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StoreProductManager } from "@/app/dashboard/(routes)/_components/store-product-manager";

export default async function TeacherStorePage() {
    const { userId, user } = await auth();
    if (!userId) return redirect("/");

    if (user?.role !== "TEACHER") {
        return redirect("/dashboard");
    }

    return <StoreProductManager apiBase="/api/teacher/store" />;
}
