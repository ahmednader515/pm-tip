import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { QuestionBankSettingsEditor } from "@/app/dashboard/(routes)/_components/question-bank-settings-editor";

export default async function AdminQuestionBankSettingsPage() {
  const { userId, user } = await auth();
  if (!userId) return redirect("/");

  if (user?.role !== "ADMIN") {
    return redirect("/dashboard");
  }

  return <QuestionBankSettingsEditor apiBase="/api/admin/question-bank/settings" />;
}
