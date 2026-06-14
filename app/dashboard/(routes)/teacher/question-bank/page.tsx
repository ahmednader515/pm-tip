import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { QuestionBankSettingsEditor } from "@/app/dashboard/(routes)/_components/question-bank-settings-editor";

export default async function TeacherQuestionBankSettingsPage() {
  const { userId, user } = await auth();
  if (!userId) return redirect("/");

  if (user?.role !== "TEACHER") {
    return redirect("/dashboard");
  }

  return <QuestionBankSettingsEditor apiBase="/api/teacher/question-bank/settings" />;
}
