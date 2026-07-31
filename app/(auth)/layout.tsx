import { LanguageSwitcher } from "@/components/language-switcher";

const AuthLayout = ({
    children
}: {
    children: React.ReactNode
}) => {
    return ( 
        <div className="relative flex-1 flex items-center justify-center">
            <div className="absolute top-4 end-4 z-20">
                <LanguageSwitcher />
            </div>
            {children}
        </div>
     );
}
 
export default AuthLayout;
