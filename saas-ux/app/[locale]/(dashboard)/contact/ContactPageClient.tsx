"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Building2, Mail, MessageSquareText } from "lucide-react";

type InquiryType = "sales" | "support" | "suggestions" | "featureRequest";

const inquirySubjectMap: Record<InquiryType, string> = {
  sales: "Sales Inquiry",
  support: "Support Request",
  suggestions: "Suggestion",
  featureRequest: "Feature Request",
};

const inquiryRecipientMap: Record<InquiryType, string> = {
  sales: "sales@company.com",
  support: "support@getsafe360.ai",
  suggestions: "inquiry@getsafe360.ai",
  featureRequest: "inquiry@getsafe360.ai",
};

export default function ContactPageClient() {
  const t = useTranslations("Support");
  const [inquiryType, setInquiryType] = useState<InquiryType>("sales");
  const [senderEmail, setSenderEmail] = useState("");
  const [message, setMessage] = useState("");

  const previewRecipient = inquiryRecipientMap[inquiryType];
  const previewSubject = inquirySubjectMap[inquiryType];

  const mailtoHref = useMemo(() => {
    const subject = `${previewSubject} - ${senderEmail || "No email provided"}`;
    const body = [
      `Inquiry type: ${previewSubject}`,
      `Sender email: ${senderEmail || "Not provided"}`,
      "",
      message || "(Please add your message)",
    ].join("\n");

    return `mailto:${previewRecipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [message, previewRecipient, previewSubject, senderEmail]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.location.href = mailtoHref;
  };

  return (
    <div className="min-h-screen bg-[var(--background-default)] text-[var(--text-default)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-10">
        <section className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{t("contactPage.hero.title")}</h1>
          <p className="text-lg text-[var(--text-subtle)] max-w-3xl">{t("contactPage.hero.bodyLine1")}</p>
          <p className="text-lg text-[var(--text-subtle)] max-w-3xl">{t("contactPage.hero.bodyLine2")}</p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/20">
                <Mail className="h-5 w-5 text-[var(--text-primary)]" />
              </div>
              <h2 className="text-xl font-semibold">
                {t("contactPage.direct.inquiryTitle")}
              </h2>
            </div>
            <a
              href="mailto:inquiry@getsafe360.ai"
              className="font-mono text-[var(--text-primary)] hover:underline"
            >
              inquiry@getsafe360.ai
            </a>
            <p className="mt-3 text-sm text-[var(--text-subtle)]">
              {t("contactPage.direct.supportHint")}
            </p>
            <Link
              href="/support"
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:underline"
            >
              {t("contactPage.direct.supportCta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-[var(--radius-md)] bg-violet-500/10 border border-violet-500/20">
                <Building2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <h2 className="text-xl font-semibold">
                {t("contactPage.direct.salesTitle")}
              </h2>
            </div>
            <a
              href="mailto:sales@company.com"
              className="font-mono text-[var(--text-primary)] hover:underline"
            >
              sales@company.com
            </a>
            <p className="mt-3 text-sm text-[var(--text-subtle)]">
              {t("contactPage.direct.salesDescription")}
            </p>
          </div>
        </section>

        <section className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-[var(--radius-md)] bg-emerald-500/10 border border-emerald-500/20">
              <MessageSquareText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-semibold">
              {t("contactPage.form.title")}
            </h2>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-[var(--text-subtle)]">
                  {t("contactPage.form.typeLabel")}
                </span>
                <select
                  className="w-full rounded-[var(--radius-md)] border border-[var(--card-border)] bg-[var(--background-default)] px-3 py-2"
                  value={inquiryType}
                  onChange={(event) =>
                    setInquiryType(event.target.value as InquiryType)
                  }
                >
                  <option value="sales">{t("contactPage.form.options.sales")}</option>
                  <option value="support">{t("contactPage.form.options.support")}</option>
                  <option value="suggestions">{t("contactPage.form.options.suggestions")}</option>
                  <option value="featureRequest">{t("contactPage.form.options.featureRequest")}</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-[var(--text-subtle)]">
                  {t("contactPage.form.emailLabel")}
                </span>
                <input
                  type="email"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--card-border)] bg-[var(--background-default)] px-3 py-2"
                  placeholder="you@workspace.com"
                  value={senderEmail}
                  onChange={(event) => setSenderEmail(event.target.value)}
                  required
                />
              </label>
            </div>

            <label className="space-y-2 block">
              <span className="text-sm text-[var(--text-subtle)]">
                {t("contactPage.form.messageLabel")}
              </span>
              <textarea
                className="w-full min-h-36 rounded-[var(--radius-md)] border border-[var(--card-border)] bg-[var(--background-default)] px-3 py-2"
                placeholder={t("contactPage.form.messagePlaceholder")}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
              />
            </label>

            <div className="rounded-[var(--radius-md)] border border-[var(--card-border)] bg-[var(--background-default)] p-3 text-sm text-[var(--text-subtle)]">
              <p>
                <strong className="text-[var(--text-default)]">{t("contactPage.form.previewRecipient")}</strong>{" "}
                {previewRecipient}
              </p>
              <p>
                <strong className="text-[var(--text-default)]">{t("contactPage.form.previewSubject")}</strong>{" "}
                {previewSubject}
              </p>
            </div>

            <button type="submit" className="btn btn-blue">
              {t("contactPage.form.submit")}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
