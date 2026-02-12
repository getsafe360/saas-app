"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Building2, FileText, Scale } from "lucide-react";

export default function ImprintPage() {
  const t = useTranslations("imprint");

  return (
    <div className="min-h-screen bg-[var(--background-default)] text-[var(--text-default)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-8">
        <section className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t("title")}</h1>
          <div className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]">
            <p className="font-semibold">{t("company")}</p>
            <p className="text-sm text-[var(--text-subtle)] mt-3">{t("registeredOfficeLabel")}</p>
            <p className="whitespace-pre-line text-[var(--text-default)]">{t("registeredOffice")}</p>
            <p className="mt-4 text-sm text-[var(--text-subtle)]">{t("registrationNumberLabel")}</p>
            <p>{t("registrationNumber")}</p>
          </div>
        </section>

        <section className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-5 w-5 text-[var(--text-primary)]" />
            <h2 className="text-xl font-semibold">{t("contactTitle")}</h2>
          </div>
          <p className="text-[var(--text-subtle)]">
            {t("contactTextBefore")}{" "}
            <Link href="/contact" className="text-[var(--text-primary)] hover:underline">
              {t("contactLinkLabel")}
            </Link>
          </p>
        </section>

        <section className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)] space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--text-subtle)]" />
            <h2 className="text-xl font-semibold">{t("responsibleTitle")}</h2>
          </div>
          <p>{t("responsibleEntity")}</p>
        </section>

        <section className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)] space-y-3">
          <h2 className="text-xl font-semibold">{t("vatTitle")}</h2>
          <p className="text-[var(--text-subtle)]">{t("vatText")}</p>
        </section>

        <section className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)] space-y-3">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[var(--text-subtle)]" />
            <h2 className="text-xl font-semibold">{t("disputeTitle")}</h2>
          </div>
          <p className="text-[var(--text-subtle)]">{t("disputeText")}</p>
        </section>

        <section className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)] space-y-3">
          <h2 className="text-xl font-semibold">{t("legalNoticeTitle")}</h2>
          <p className="text-[var(--text-subtle)]">{t("legalNoticeLine1")}</p>
          <p className="text-[var(--text-subtle)]">{t("legalNoticeLine2")}</p>
        </section>
      </div>
    </div>
  );
}
