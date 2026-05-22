import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StoreProductManager } from "@/app/dashboard/(routes)/_components/store-product-manager";

export default async function AdminStorePage() {
    const { userId, user } = await auth();
    if (!userId) return redirect("/");

    if (user?.role !== "ADMIN") {
        return redirect("/dashboard");
    }

    return <StoreProductManager apiBase="/api/admin/store" showCreator />;
}
