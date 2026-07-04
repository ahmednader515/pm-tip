"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHomepageSettings } from "@/components/homepage-settings-provider";

export const Footer = () => {
  const pathname = usePathname();
  const { footerPhone } = useHomepageSettings();

  // Check if we're on a page with a sidebar
  const hasSidebar = pathname?.startsWith('/dashboard') || pathname?.startsWith('/courses');
  
  return (
    <footer className="py-6 border-t">
      <div className="container mx-auto px-4">
        <div className={`text-center text-muted-foreground ${
          hasSidebar 
            ? 'md:rtl:pr-56 md:ltr:pl-56 lg:rtl:pr-80 lg:ltr:pl-80' 
            : ''
        }`}>
          <div className="inline-block bg-brand/10 border-2 border-brand/20 rounded-lg px-6 py-3 mb-4">
            <p className="font-semibold text-lg text-brand"> واتساب : {footerPhone}</p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm mb-4">
            <Link href="/privacy-policy" className="hover:text-brand transition-colors">
              سياسة الخصوصية
            </Link>
            <span className="text-border">|</span>
            <Link href="/refund-policy" className="hover:text-brand transition-colors">
              سياسة الاسترداد
            </Link>
            <span className="text-border">|</span>
            <Link href="/terms-of-service" className="hover:text-brand transition-colors">
              الشروط والأحكام
            </Link>
            <span className="text-border">|</span>
            <Link href="/contact" className="hover:text-brand transition-colors">
              تواصل معنا
            </Link>
          </nav>
          
          <p>© {new Date().getFullYear()} Mordesu Studio. جميع الحقوق محفوظة</p>
        </div>
      </div>
    </footer>
  );
}; 