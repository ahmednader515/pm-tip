import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDashboardUrlByRole } from "@/lib/utils";
import { StoreClient } from "./_components/store-client";

export default async function StorePage() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return redirect("/sign-in");
    }

    if (session.user.role !== "USER") {
        return redirect(getDashboardUrlByRole(session.user.role));
    }

    return <StoreClient />;
}
