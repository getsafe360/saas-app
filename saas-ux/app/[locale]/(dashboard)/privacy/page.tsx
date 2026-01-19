"use client";

import { useTranslations } from "next-intl";
import { Shield, Lock, Database, UserCheck, Globe, FileText, Mail } from "lucide-react";

export default function PrivacyPage() {
  const t = useTranslations("privacy");

  const sections = [
    { key: "intro", icon: Shield },
    { key: "informationWeCollect", icon: Database },
    { key: "howWeUse", icon: FileText },
    { key: "disclosure", icon: UserCheck },
    { key: "security", icon: Lock },
    { key: "dataRetention", icon: Database },
    { key: "yourRights", icon: UserCheck },
    { key: "gdpr", icon: Globe },
    { key: "cookies", icon: Database },
    { key: "childrenPrivacy", icon: Shield },
    { key: "international", icon: Globe },
    { key: "changes", icon: FileText },
    { key: "contact", icon: Mail },
  ];

  return (
    <div className="max-w-full">
      <section className="py-4 border-t dark:border-[#1b2430]">
        {/* Header */}
        <div className="space-y-2 p-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-sky-500 via-purple-800 to-red-600 bg-clip-text text-transparent">
              {t("title")}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">{t("lastUpdated")}</p>
        </div>

        {/* Content */}
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl space-y-8">
          {/* Introduction */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-sky-500" />
              <h2 className="text-2xl font-semibold">{t("intro.title")}</h2>
            </div>
            <p className="text-base text-muted-foreground leading-relaxed">
              {t("intro.content")}
            </p>
          </div>

          {/* Information We Collect */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-6 h-6 text-purple-500" />
              <h2 className="text-2xl font-semibold">
                {t("informationWeCollect.title")}
              </h2>
            </div>

            {/* Personal Information */}
            <div className="space-y-3 pl-4">
              <h3 className="text-xl font-medium">
                {t("informationWeCollect.personal.title")}
              </h3>
              <p className="text-base text-muted-foreground">
                {t("informationWeCollect.personal.content")}
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>{t("informationWeCollect.personal.items.1")}</li>
                <li>{t("informationWeCollect.personal.items.2")}</li>
                <li>{t("informationWeCollect.personal.items.3")}</li>
                <li>{t("informationWeCollect.personal.items.4")}</li>
              </ul>
            </div>

            {/* Automated Information */}
            <div className="space-y-3 pl-4">
              <h3 className="text-xl font-medium">
                {t("informationWeCollect.automated.title")}
              </h3>
              <p className="text-base text-muted-foreground">
                {t("informationWeCollect.automated.content")}
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>{t("informationWeCollect.automated.items.1")}</li>
                <li>{t("informationWeCollect.automated.items.2")}</li>
                <li>{t("informationWeCollect.automated.items.3")}</li>
              </ul>
            </div>

            {/* Website Analysis Data */}
            <div className="space-y-3 pl-4">
              <h3 className="text-xl font-medium">
                {t("informationWeCollect.analyzed.title")}
              </h3>
              <p className="text-base text-muted-foreground">
                {t("informationWeCollect.analyzed.content")}
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>{t("informationWeCollect.analyzed.items.1")}</li>
                <li>{t("informationWeCollect.analyzed.items.2")}</li>
                <li>{t("informationWeCollect.analyzed.items.3")}</li>
              </ul>
            </div>
          </div>

          {/* How We Use */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-semibold">{t("howWeUse.title")}</h2>
            </div>
            <p className="text-base text-muted-foreground">{t("howWeUse.content")}</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground pl-4">
              <li>{t("howWeUse.items.1")}</li>
              <li>{t("howWeUse.items.2")}</li>
              <li>{t("howWeUse.items.3")}</li>
              <li>{t("howWeUse.items.4")}</li>
              <li>{t("howWeUse.items.5")}</li>
              <li>{t("howWeUse.items.6")}</li>
              <li>{t("howWeUse.items.7")}</li>
            </ul>
          </div>

          {/* Information Sharing and Disclosure */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-green-500" />
              <h2 className="text-2xl font-semibold">{t("disclosure.title")}</h2>
            </div>
            <p className="text-base text-muted-foreground">{t("disclosure.intro")}</p>

            <div className="space-y-3 pl-4">
              <h3 className="text-xl font-medium">
                {t("disclosure.serviceProviders.title")}
              </h3>
              <p className="text-base text-muted-foreground">
                {t("disclosure.serviceProviders.content")}
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>{t("disclosure.serviceProviders.items.1")}</li>
                <li>{t("disclosure.serviceProviders.items.2")}</li>
                <li>{t("disclosure.serviceProviders.items.3")}</li>
                <li>{t("disclosure.serviceProviders.items.4")}</li>
              </ul>
            </div>

            <div className="space-y-2 pl-4">
              <h3 className="text-xl font-medium">
                {t("disclosure.legal.title")}
              </h3>
              <p className="text-base text-muted-foreground">
                {t("disclosure.legal.content")}
              </p>
            </div>

            <div className="space-y-2 pl-4">
              <h3 className="text-xl font-medium">
                {t("disclosure.businessTransfer.title")}
              </h3>
              <p className="text-base text-muted-foreground">
                {t("disclosure.businessTransfer.content")}
              </p>
            </div>

            <div className="space-y-2 pl-4">
              <h3 className="text-xl font-medium">
                {t("disclosure.consent.title")}
              </h3>
              <p className="text-base text-muted-foreground">
                {t("disclosure.consent.content")}
              </p>
            </div>
          </div>

          {/* Security */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-6 h-6 text-red-500" />
              <h2 className="text-2xl font-semibold">{t("security.title")}</h2>
            </div>
            <p className="text-base text-muted-foreground">{t("security.content")}</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground pl-4">
              <li>{t("security.items.1")}</li>
              <li>{t("security.items.2")}</li>
              <li>{t("security.items.3")}</li>
              <li>{t("security.items.4")}</li>
              <li>{t("security.items.5")}</li>
              <li>{t("security.items.6")}</li>
            </ul>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {t("security.note")}
              </p>
            </div>
          </div>

          {/* Data Retention */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-6 h-6 text-indigo-500" />
              <h2 className="text-2xl font-semibold">
                {t("dataRetention.title")}
              </h2>
            </div>
            <p className="text-base text-muted-foreground">
              {t("dataRetention.content")}
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground pl-4">
              <li>{t("dataRetention.items.1")}</li>
              <li>{t("dataRetention.items.2")}</li>
              <li>{t("dataRetention.items.3")}</li>
              <li>{t("dataRetention.items.4")}</li>
            </ul>
          </div>

          {/* Your Rights */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-teal-500" />
              <h2 className="text-2xl font-semibold">{t("yourRights.title")}</h2>
            </div>
            <p className="text-base text-muted-foreground">{t("yourRights.intro")}</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground pl-4">
              <li>{t("yourRights.items.1")}</li>
              <li>{t("yourRights.items.2")}</li>
              <li>{t("yourRights.items.3")}</li>
              <li>{t("yourRights.items.4")}</li>
              <li>{t("yourRights.items.5")}</li>
              <li>{t("yourRights.items.6")}</li>
              <li>{t("yourRights.items.7")}</li>
            </ul>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {t("yourRights.exercise")}
              </p>
            </div>
          </div>

          {/* GDPR */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6 text-purple-500" />
              <h2 className="text-2xl font-semibold">{t("gdpr.title")}</h2>
            </div>
            <p className="text-base text-muted-foreground">{t("gdpr.content")}</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground pl-4">
              <li>{t("gdpr.items.1")}</li>
              <li>{t("gdpr.items.2")}</li>
              <li>{t("gdpr.items.3")}</li>
              <li>{t("gdpr.items.4")}</li>
            </ul>
            <p className="text-base text-muted-foreground pl-4">
              {t("gdpr.transfer")}
            </p>
          </div>

          {/* Cookies */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-6 h-6 text-orange-500" />
              <h2 className="text-2xl font-semibold">{t("cookies.title")}</h2>
            </div>
            <p className="text-base text-muted-foreground">{t("cookies.content")}</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground pl-4">
              <li>{t("cookies.items.1")}</li>
              <li>{t("cookies.items.2")}</li>
              <li>{t("cookies.items.3")}</li>
              <li>{t("cookies.items.4")}</li>
            </ul>
            <p className="text-base text-muted-foreground pl-4">
              {t("cookies.control")}
            </p>
          </div>

          {/* Children's Privacy */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-pink-500" />
              <h2 className="text-2xl font-semibold">
                {t("childrenPrivacy.title")}
              </h2>
            </div>
            <p className="text-base text-muted-foreground">
              {t("childrenPrivacy.content")}
            </p>
          </div>

          {/* International Data Transfers */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6 text-cyan-500" />
              <h2 className="text-2xl font-semibold">
                {t("international.title")}
              </h2>
            </div>
            <p className="text-base text-muted-foreground">
              {t("international.content")}
            </p>
          </div>

          {/* Changes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-amber-500" />
              <h2 className="text-2xl font-semibold">{t("changes.title")}</h2>
            </div>
            <p className="text-base text-muted-foreground">
              {t("changes.content")}
            </p>
          </div>

          {/* Contact */}
          <div className="space-y-4 pb-8">
            <div className="flex items-center gap-2">
              <Mail className="w-6 h-6 text-green-500" />
              <h2 className="text-2xl font-semibold">{t("contact.title")}</h2>
            </div>
            <p className="text-base text-muted-foreground">
              {t("contact.content")}
            </p>
            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">{t("contact.email")}</p>
              <p className="text-sm font-medium">{t("contact.address")}</p>
              <p className="text-sm text-muted-foreground">
                {t("contact.mail")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
