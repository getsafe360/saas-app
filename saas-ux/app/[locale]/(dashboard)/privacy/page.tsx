"use client";

import { useTranslations } from "next-intl";
import { Database, FileText, Globe, Lock, Mail, Shield, UserCheck } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

type SectionProps = {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
};

function PrivacySection({ icon: Icon, title, children }: SectionProps) {
  return (
    <section className="rounded-[var(--card-radius)] border border-[var(--card-border)] bg-[var(--card-bg)] p-[var(--card-padding)] shadow-[var(--card-shadow)] space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-default)] p-2">
          <Icon className="h-5 w-5 text-[var(--text-primary)]" />
        </div>
        <h2 className="text-2xl font-semibold text-[var(--text-default)]">{title}</h2>
      </div>
      <div className="space-y-4 text-[var(--text-subtle)]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  return (
    <div className="min-h-screen bg-[var(--background-default)] text-[var(--text-default)]">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
        <header className="space-y-3 rounded-[var(--card-radius)] border border-[var(--card-border)] bg-[var(--card-bg)] p-[var(--card-padding)] shadow-[var(--card-shadow)]">
          <p className="text-sm font-medium text-[var(--text-primary)]">{t("lastUpdated")}</p>
          <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
        </header>

        <PrivacySection icon={Shield} title={t("intro.title")}>
          <p>{t("intro.content")}</p>
        </PrivacySection>

        <PrivacySection icon={Database} title={t("informationWeCollect.title")}>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[var(--text-default)]">{t("informationWeCollect.personal.title")}</h3>
            <p>{t("informationWeCollect.personal.content")}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t("informationWeCollect.personal.items.1")}</li>
              <li>{t("informationWeCollect.personal.items.2")}</li>
              <li>{t("informationWeCollect.personal.items.3")}</li>
              <li>{t("informationWeCollect.personal.items.4")}</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[var(--text-default)]">{t("informationWeCollect.automated.title")}</h3>
            <p>{t("informationWeCollect.automated.content")}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t("informationWeCollect.automated.items.1")}</li>
              <li>{t("informationWeCollect.automated.items.2")}</li>
              <li>{t("informationWeCollect.automated.items.3")}</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[var(--text-default)]">{t("informationWeCollect.analyzed.title")}</h3>
            <p>{t("informationWeCollect.analyzed.content")}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t("informationWeCollect.analyzed.items.1")}</li>
              <li>{t("informationWeCollect.analyzed.items.2")}</li>
              <li>{t("informationWeCollect.analyzed.items.3")}</li>
            </ul>
          </div>
        </PrivacySection>

        <PrivacySection icon={FileText} title={t("howWeUse.title")}>
          <p>{t("howWeUse.content")}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("howWeUse.items.1")}</li><li>{t("howWeUse.items.2")}</li><li>{t("howWeUse.items.3")}</li>
            <li>{t("howWeUse.items.4")}</li><li>{t("howWeUse.items.5")}</li><li>{t("howWeUse.items.6")}</li><li>{t("howWeUse.items.7")}</li>
          </ul>
        </PrivacySection>

        <PrivacySection icon={UserCheck} title={t("disclosure.title")}>
          <p>{t("disclosure.intro")}</p>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[var(--text-default)]">{t("disclosure.serviceProviders.title")}</h3>
            <p>{t("disclosure.serviceProviders.content")}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t("disclosure.serviceProviders.items.1")}</li><li>{t("disclosure.serviceProviders.items.2")}</li>
              <li>{t("disclosure.serviceProviders.items.3")}</li><li>{t("disclosure.serviceProviders.items.4")}</li>
            </ul>
          </div>
          <div className="space-y-2"><h3 className="text-lg font-semibold text-[var(--text-default)]">{t("disclosure.legal.title")}</h3><p>{t("disclosure.legal.content")}</p></div>
          <div className="space-y-2"><h3 className="text-lg font-semibold text-[var(--text-default)]">{t("disclosure.businessTransfer.title")}</h3><p>{t("disclosure.businessTransfer.content")}</p></div>
          <div className="space-y-2"><h3 className="text-lg font-semibold text-[var(--text-default)]">{t("disclosure.consent.title")}</h3><p>{t("disclosure.consent.content")}</p></div>
        </PrivacySection>

        <PrivacySection icon={Lock} title={t("security.title")}>
          <p>{t("security.content")}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("security.items.1")}</li><li>{t("security.items.2")}</li><li>{t("security.items.3")}</li>
            <li>{t("security.items.4")}</li><li>{t("security.items.5")}</li><li>{t("security.items.6")}</li>
          </ul>
          <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-default)] p-4 text-sm">{t("security.note")}</div>
        </PrivacySection>

        <PrivacySection icon={Database} title={t("dataRetention.title")}>
          <p>{t("dataRetention.content")}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("dataRetention.items.1")}</li><li>{t("dataRetention.items.2")}</li><li>{t("dataRetention.items.3")}</li><li>{t("dataRetention.items.4")}</li>
          </ul>
        </PrivacySection>

        <PrivacySection icon={UserCheck} title={t("yourRights.title")}>
          <p>{t("yourRights.intro")}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("yourRights.items.1")}</li><li>{t("yourRights.items.2")}</li><li>{t("yourRights.items.3")}</li><li>{t("yourRights.items.4")}</li>
            <li>{t("yourRights.items.5")}</li><li>{t("yourRights.items.6")}</li><li>{t("yourRights.items.7")}</li>
          </ul>
          <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-default)] p-4 text-sm">{t("yourRights.exercise")}</div>
        </PrivacySection>

        <PrivacySection icon={Globe} title={t("gdpr.title")}>
          <p>{t("gdpr.content")}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("gdpr.items.1")}</li><li>{t("gdpr.items.2")}</li><li>{t("gdpr.items.3")}</li><li>{t("gdpr.items.4")}</li>
          </ul>
          <p>{t("gdpr.transfer")}</p>
        </PrivacySection>

        <PrivacySection icon={Database} title={t("cookies.title")}>
          <p>{t("cookies.content")}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t("cookies.items.1")}</li><li>{t("cookies.items.2")}</li><li>{t("cookies.items.3")}</li><li>{t("cookies.items.4")}</li>
          </ul>
          <p>{t("cookies.control")}</p>
        </PrivacySection>

        <PrivacySection icon={Shield} title={t("childrenPrivacy.title")}>
          <p>{t("childrenPrivacy.content")}</p>
        </PrivacySection>

        <PrivacySection icon={Globe} title={t("international.title")}>
          <p>{t("international.content")}</p>
        </PrivacySection>

        <PrivacySection icon={FileText} title={t("changes.title")}>
          <p>{t("changes.content")}</p>
        </PrivacySection>

        <PrivacySection icon={Mail} title={t("contact.title")}>
          <p>{t("contact.content")}</p>
          <div className="rounded-[var(--radius-md)] border border-[var(--card-border)] bg-[var(--background-default)] p-4 text-sm space-y-1">
            <p className="font-medium text-[var(--text-default)]">{t("contact.email")}</p>
            <p className="font-medium text-[var(--text-default)]">{t("contact.address")}</p>
            <p>{t("contact.mail")}</p>
          </div>
        </PrivacySection>
      </div>
    </div>
  );
}
