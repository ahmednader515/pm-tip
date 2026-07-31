import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from 'next/font/local';
import "./globals.css";
import { Providers } from "@/components/providers";
import { Footer } from "@/components/footer";
import { NavigationLoading } from "@/components/navigation-loading";
import { getCachedHomepageContent } from "@/lib/homepage-db";
import { Suspense } from "react";
import { theme } from "@/lib/theme";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { getDir, type Locale } from "@/i18n/config";

/** Homepage CMS data must be read at request time, not baked in at build. */
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cairo = localFont({
  src: '../public/fonts/Cairo-VariableFont_slnt,wght.ttf',
  variable: '--font-cairo',
  display: 'swap',
  preload: true,
});

export async function generateMetadata(): Promise<Metadata> {
  const { headerLogoUrl } = await getCachedHomepageContent();
  const t = await getTranslations("metadata");

  return {
    title: t("title"),
    description: t("description"),
    icons: {
      icon: [{ url: headerLogoUrl }],
      shortcut: [{ url: headerLogoUrl }],
      apple: [{ url: headerLogoUrl }],
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const homepageSettings = await getCachedHomepageContent();
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const dir = getDir(locale);

  return (
    <html suppressHydrationWarning lang={locale} dir={dir} className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable}`}>
      <body suppressHydrationWarning className="font-cairo">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (document.documentElement) {
                  document.documentElement.style.setProperty('--brand', '${theme.brand}');
                }
              })();
            `,
          }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers homepageSettings={homepageSettings}>
            <Suspense fallback={null}>
              <NavigationLoading />
            </Suspense>
            <div className="min-h-screen flex flex-col">
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
