import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.refund");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function RefundPolicyPage() {
  const t = await getTranslations("legal.refund");
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
        <p>{t("s3.intro")}</p>
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
          <li>{t("s4.item3")}</li>
          <li>{t("s4.item4")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("s5.heading")}</h2>
        <p>
          {t.rich("s5.intro", {
            contactLink: (chunks) => (
              <Link href="/contact">{chunks}</Link>
            ),
          })}
        </p>
        <ul>
          <li>{t("s5.item1")}</li>
          <li>{t("s5.item2")}</li>
          <li>{t("s5.item3")}</li>
          <li>{t("s5.item4")}</li>
        </ul>
      </section>

      <section>
        <h2>{t("s6.heading")}</h2>
        <p>{t("s6.p1")}</p>
      </section>

      <section>
        <h2>{t("s7.heading")}</h2>
        <p>{t("s7.p1")}</p>
      </section>

      <section>
        <h2>{t("s8.heading")}</h2>
        <p>{t("s8.p1")}</p>
      </section>
    </LegalPage>
  );
}
