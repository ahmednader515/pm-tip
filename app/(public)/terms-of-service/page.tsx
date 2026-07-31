import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function TermsOfServicePage() {
  const t = await getTranslations("legal.terms");
  const tLegal = await getTranslations("legal");

  return (
    <LegalPage title={t("title")} lastUpdated={tLegal("lastUpdatedDate")}>
      <section>
        <h2>{t("s1.heading")}</h2>
        <p>{t("s1.p1")}</p>
      </section>

      <section>
        <h2>{t("s2.heading")}</h2>
        <p>{t("s2.p1")}</p>
      </section>

      <section>
        <h2>{t("s3.heading")}</h2>
        <ul>
          <li>{t("s3.item1")}</li>
          <li>{t("s3.item2")}</li>
          <li>{t("s3.item3")}</li>
          <li>{t("s3.item4")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("s4.heading")}</h2>
        <ul>
          <li>{t("s4.item1")}</li>
          <li>{t("s4.item2")}</li>
          <li>
            {t.rich("s4.item3", {
              refundLink: (chunks) => (
                <Link href="/refund-policy">{chunks}</Link>
              ),
            })}
          </li>
        </ul>
      </section>

      <section>
        <h2>{t("s5.heading")}</h2>
        <p>{t("s5.p1")}</p>
      </section>

      <section>
        <h2>{t("s6.heading")}</h2>
        <p>{t("s6.intro")}</p>
        <ul>
          <li>{t("s6.item1")}</li>
          <li>{t("s6.item2")}</li>
          <li>{t("s6.item3")}</li>
          <li>{t("s6.item4")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("s7.heading")}</h2>
        <p>{t("s7.p1")}</p>
      </section>

      <section>
        <h2>{t("s8.heading")}</h2>
        <p>{t("s8.p1")}</p>
      </section>

      <section>
        <h2>{t("s9.heading")}</h2>
        <p>
          {t.rich("s9.p1", {
            privacyLink: (chunks) => (
              <Link href="/privacy-policy">{chunks}</Link>
            ),
          })}
        </p>
      </section>

      <section>
        <h2>{t("s10.heading")}</h2>
        <p>{t("s10.p1")}</p>
      </section>

      <section>
        <h2>{t("s11.heading")}</h2>
        <p>
          {t.rich("s11.p1", {
            contactLink: (chunks) => (
              <Link href="/contact">{chunks}</Link>
            ),
          })}
        </p>
      </section>
    </LegalPage>
  );
}
