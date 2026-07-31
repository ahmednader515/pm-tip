import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PrivacyPolicyPage() {
  const t = await getTranslations("legal.privacy");
  const tLegal = await getTranslations("legal");

  return (
    <LegalPage title={t("title")} lastUpdated={tLegal("lastUpdatedDate")}>
      <section>
        <h2>{t("s1.heading")}</h2>
        <p>{t("s1.p1")}</p>
      </section>

      <section>
        <h2>{t("s2.heading")}</h2>
        <p>{t("s2.intro")}</p>
        <ul>
          <li>{t("s2.item1")}</li>
          <li>{t("s2.item2")}</li>
          <li>{t("s2.item3")}</li>
          <li>{t("s2.item4")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("s3.heading")}</h2>
        <p>{t("s3.intro")}</p>
        <ul>
          <li>{t("s3.item1")}</li>
          <li>{t("s3.item2")}</li>
          <li>{t("s3.item3")}</li>
          <li>{t("s3.item4")}</li>
          <li>{t("s3.item5")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("s4.heading")}</h2>
        <p>{t("s4.p1")}</p>
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
            contactLink: (chunks) => (
              <Link href="/contact">{chunks}</Link>
            ),
          })}
        </p>
      </section>
    </LegalPage>
  );
}
