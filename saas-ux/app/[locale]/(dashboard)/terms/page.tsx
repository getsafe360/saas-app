import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import type { Locale } from "@/i18n/locales";
import { FileText, Scale, ShieldCheck } from "lucide-react";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Terms.meta" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

const sectionKeys = [
  "acceptance",
  "license",
  "eligibility",
  "restrictedUse",
  "orders",
  "enforcement",
  "termination",
  "intellectualProperty",
  "warranty",
  "liability",
  "law",
  "changes",
] as const;

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Terms" });

  return (
    <div className="min-h-screen bg-[var(--background-default)] text-[var(--text-default)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-8">
        <section className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t("title")}</h1>
          <div className="inline-flex items-center gap-2 text-sm text-[var(--text-subtle)] rounded-[var(--radius-md)] border border-[var(--card-border)] px-3 py-1.5 bg-[var(--card-bg)]">
            <FileText className="h-4 w-4" />
            <span>
              {t("effectiveDateLabel")} {t("effectiveDate")}
            </span>
          </div>
          <p className="text-[var(--text-subtle)] text-base leading-relaxed">{t("intro")}</p>
        </section>

        <section className="space-y-4">
          {sectionKeys.map((key) => (
            <article
              key={key}
              className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]"
            >
              <h2 className="text-xl font-semibold mb-3">{t(`sections.${key}.title`)}</h2>
              <p className="text-[var(--text-subtle)] leading-relaxed">{t(`sections.${key}.body`)}</p>
            </article>
          ))}
        </section>

        <section className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)] space-y-3">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[var(--text-subtle)]" />
            <h2 className="text-xl font-semibold">{t("contact.title")}</h2>
          </div>
          <p className="text-[var(--text-subtle)]">
            {t("contact.before")} <Link href="/contact" className="text-[var(--text-primary)] hover:underline">{t("contact.link")}</Link>
            {t("contact.after")}
          </p>
          <div className="pt-2 text-xs text-[var(--text-subtle)] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span>GetSafe 360 AI LIMITED</span>
          </div>
        </section>
      </div>
    </div>
  );
}
