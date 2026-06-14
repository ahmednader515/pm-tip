import { Navbar } from "./_components/navbar";
import { Sidebar } from "./_components/sidebar";
import { QuestionBankSettingsProvider } from "@/components/question-bank-settings-provider";
import { getCachedQuestionBankSettings } from "@/lib/question-bank-settings-db";

const DashboardLayout = async ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const questionBankSettings = await getCachedQuestionBankSettings();

    return ( 
        <QuestionBankSettingsProvider settings={questionBankSettings}>
            <div className="min-h-screen flex flex-col dashboard-layout">
                <div className="h-[80px] fixed inset-x-0 top-0 w-full z-50">
                    <Navbar />
                </div>
                <div className="hidden md:flex h-[calc(100vh-80px)] w-56 flex-col fixed inset-x-0 top-[80px] rtl:right-0 ltr:left-0 z-40">
                    <Sidebar />
                </div>
                <main className="md:rtl:pr-56 md:ltr:pl-56 pt-[80px] flex-1">
                    {children}
                </main>
            </div>
        </QuestionBankSettingsProvider>
     );
}
 
export default DashboardLayout;