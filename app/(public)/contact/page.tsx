import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Mail, Clock, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getCachedHomepageContent } from "@/lib/homepage-db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.contact");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

function formatWhatsAppLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0")
    ? `20${digits.slice(1)}`
    : digits.startsWith("20")
      ? digits
      : `20${digits}`;
  return `https://wa.me/${normalized}`;
}

export default async function ContactPage() {
  const t = await getTranslations("legal.contact");
  const { footerPhone } = await getCachedHomepageContent();
  const whatsappUrl = formatWhatsAppLink(footerPhone);

  return (
    <div className="container mx-auto px-4 max-w-3xl">
      <h1 className="text-3xl font-bold text-brand mb-2">{t("title")}</h1>
      <p className="text-muted-foreground mb-10">
        {t("subtitle")}
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 rounded-lg border bg-card p-6 transition-colors hover:border-brand/50 hover:bg-brand/5"
        >
          <div className="rounded-full bg-brand/10 p-3 text-brand">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-1">{t("whatsapp.title")}</h2>
            <p className="text-muted-foreground text-sm mb-2">
              {t("whatsapp.description")}
            </p>
            <p className="text-brand font-medium" dir="ltr">
              {footerPhone}
            </p>
          </div>
        </a>

        <div className="flex items-start gap-4 rounded-lg border bg-card p-6">
          <div className="rounded-full bg-brand/10 p-3 text-brand">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-1">{t("email.title")}</h2>
            <p className="text-muted-foreground text-sm mb-2">
              {t("email.description")}
            </p>
            <p className="text-brand font-medium" dir="ltr">
              {t("email.address")}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-lg border bg-card p-6">
          <div className="rounded-full bg-brand/10 p-3 text-brand">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-1">{t("hours.title")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("hours.weekdays")}
            </p>
            <p className="text-muted-foreground text-sm">{t("hours.friday")}</p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-lg border bg-card p-6">
          <div className="rounded-full bg-brand/10 p-3 text-brand">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-1">{t("platform.title")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("platform.name")}
            </p>
            <p className="text-muted-foreground text-sm">
              {t("platform.type")}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 rounded-lg border bg-muted/30 p-6">
        <h2 className="font-semibold text-lg mb-3">{t("usefulLinks")}</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/privacy-policy" className="text-brand hover:underline">
              {t("links.privacy")}
            </Link>
          </li>
          <li>
            <Link href="/refund-policy" className="text-brand hover:underline">
              {t("links.refund")}
            </Link>
          </li>
          <li>
            <Link href="/terms-of-service" className="text-brand hover:underline">
              {t("links.terms")}
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
