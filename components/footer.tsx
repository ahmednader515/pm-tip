"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHomepageSettings } from "@/components/homepage-settings-provider";
import { useTranslations } from "next-intl";

export const Footer = () => {
  const pathname = usePathname();
  const { footerPhone } = useHomepageSettings();
  const t = useTranslations("footer");

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
            <p className="font-semibold text-lg text-brand">{t("whatsapp", { phone: footerPhone })}</p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm mb-4">
            <Link href="/privacy-policy" className="hover:text-brand transition-colors">
              {t("privacy")}
            </Link>
            <span className="text-border">|</span>
            <Link href="/refund-policy" className="hover:text-brand transition-colors">
              {t("refund")}
            </Link>
            <span className="text-border">|</span>
            <Link href="/terms-of-service" className="hover:text-brand transition-colors">
              {t("terms")}
            </Link>
            <span className="text-border">|</span>
            <Link href="/contact" className="hover:text-brand transition-colors">
              {t("contact")}
            </Link>
          </nav>
          
          <p>{t("copyright", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
};
