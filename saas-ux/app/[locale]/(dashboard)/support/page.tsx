// saas-ux/app/[locale]/(dashboard)/support/page.tsx
"use client";
import { useTranslations } from "next-intl";
import {
  Mail,
  Clock,
  User,
  CreditCard,
  Wrench,
  Shield,
  MessageCircle,
  Lightbulb,
  CheckCircle,
} from "lucide-react";

export default function SupportPage() {
  const t = useTranslations("Support");

  return (
    <div className="min-h-screen bg-[var(--background-default)]">
      {/* Hero Section */}
      <div className="text-[var(--text-default)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-5xl font-bold mb-4">{t("hero.title")}</h1>
          <p className="text-xl opacity-80 max-w-2xl">{t("hero.subtitle")}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Contact Methods */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Email Support */}
          <div className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)]">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 rounded-[var(--radius-lg)] bg-blue-500/10 border border-blue-500/20">
                <Mail className="h-8 w-8 text-[var(--text-primary)]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-[var(--text-default)]">
                  {t("contactMethods.email.title")}
                </h3>
                <p className="text-sm text-[var(--text-subtle)]">
                  {t("noPhone.message")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <a href="mailto:support@getsafe360.ai" className="btn btn-blue">
                <Mail className="h-5 w-5" />
                {t("contactMethods.email.action")}
              </a>
            </div>
          </div>

          {/* Response Time */}
          <div className="p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 rounded-[var(--radius-lg)] bg-green-500/10 border border-green-500/20">
                <Clock className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-[var(--text-default)]">
                  {t("contactMethods.responseTime.title")}
                </h3>
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--color-success)] mb-3">
              {t("contactMethods.responseTime.primary")}
            </p>
            <p className="text-sm text-[var(--text-subtle)]">
              {t("contactMethods.responseTime.secondary")}
            </p>
          </div>
        </div>

        {/* How We Can Help */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-[var(--text-default)] mb-8">
            {t("whatWeHelp.title")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Account */}
            <div className="p-[var(--space-lg)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-[var(--radius-md)] bg-blue-500/10">
                  <User className="h-6 w-6 text-[var(--text-primary)]" />
                </div>
                <h3 className="font-semibold text-[var(--text-default)]">
                  {t("whatWeHelp.categories.account.title")}
                </h3>
              </div>
              <p className="text-sm text-[var(--text-subtle)]">
                {t("whatWeHelp.categories.account.description")}.
              </p>
              <p className="mt-4 text-sm text-[var(--text-subtle)] font-mono">
                <a
                  href="https://accounts.getsafe360.ai/user"
                  className="text-[var(--text-primary)] hover:underline font-mono"
                >
                  accounts.getsafe360.ai/user
                </a>
              </p>
            </div>

            {/* Billing */}
            <div className="p-[var(--space-lg)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-[var(--radius-md)] bg-green-500/10">
                  <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-[var(--text-default)]">
                  {t("whatWeHelp.categories.billing.title")}
                </h3>
              </div>
              <p className="text-sm text-[var(--text-subtle)]">
                {t("whatWeHelp.categories.billing.description")}
              </p>
            </div>

            {/* Technical */}
            <div className="p-[var(--space-lg)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-[var(--radius-md)] bg-purple-500/10">
                  <Wrench className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold text-[var(--text-default)]">
                  {t("whatWeHelp.categories.technical.title")}
                </h3>
              </div>
              <p className="text-sm text-[var(--text-subtle)]">
                {t("whatWeHelp.categories.technical.description")}
              </p>
            </div>

            {/* Security */}
            <div className="p-[var(--space-lg)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-[var(--radius-md)] bg-red-500/10">
                  <Shield className="h-6 w-6 text-[var(--color-danger)]" />
                </div>
                <h3 className="font-semibold text-[var(--text-default)]">
                  {t("whatWeHelp.categories.security.title")}
                </h3>
              </div>
              <p className="text-sm text-[var(--text-subtle)]">
                {t("whatWeHelp.categories.security.description")}
              </p>
            </div>

            {/* General */}
            <div className="p-[var(--space-lg)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)] col-span-1 md:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-[var(--radius-md)] bg-orange-500/10">
                  <MessageCircle className="h-6 w-6 text-[var(--color-warning)]" />
                </div>
                <h3 className="font-semibold text-[var(--text-default)]">
                  {t("whatWeHelp.categories.general.title")}
                </h3>
              </div>
              <p className="text-sm text-[var(--text-subtle)]">
                {t("whatWeHelp.categories.general.description")}
              </p>
            </div>
          </div>
        </div>

        {/* Product Feedback Section */}
        <div className="mb-16 p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-[var(--radius-lg)] bg-purple-500/10 border border-purple-500/20">
              <Lightbulb className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-default)] mb-2">
                {t("feedback.title")}
              </h2>
              <p className="text-lg text-[var(--text-subtle)] mb-4">
                {t("feedback.subtitle")}
              </p>
              <p className="text-[var(--text-subtle)] mb-4">
                {t("feedback.description")}
              </p>
            </div>
          </div>

          <p className="font-semibold text-[var(--text-default)] mb-3">
            {t("feedback.encourage")}
          </p>
          <ul className="space-y-2 mb-6">
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400 mt-2 flex-shrink-0"></div>
              <span className="text-[var(--text-subtle)]">
                {t("feedback.items.item1")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400 mt-2 flex-shrink-0"></div>
              <span className="text-[var(--text-subtle)]">
                {t("feedback.items.item2")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400 mt-2 flex-shrink-0"></div>
              <span className="text-[var(--text-subtle)]">
                {t("feedback.items.item3")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400 mt-2 flex-shrink-0"></div>
              <span className="text-[var(--text-subtle)]">
                {t("feedback.items.item4")}
              </span>
            </li>
          </ul>

          <div className="p-4 rounded-[var(--radius-md)] bg-[var(--background-default)] border border-[var(--border-default)]">
            <p className="text-sm text-[var(--text-subtle)]">
              <strong className="text-[var(--text-default)]">
                Our commitment:
              </strong>{" "}
              {t("feedback.commitment")}
            </p>
          </div>
        </div>

        {/* Our Commitment */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-[var(--text-default)] mb-8 text-center">
            {t("commitment.title")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-[var(--space-lg)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] text-center shadow-[var(--card-shadow)]">
              <div className="inline-flex p-4 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
                <Clock className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-default)] mb-2">
                {t("commitment.values.response.title")}
              </h3>
              <p className="text-[var(--text-subtle)]">
                {t("commitment.values.response.description")}
              </p>
            </div>

            <div className="p-[var(--space-lg)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] text-center shadow-[var(--card-shadow)]">
              <div className="inline-flex p-4 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
                <MessageCircle className="h-8 w-8 text-[var(--text-primary)]" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-default)] mb-2">
                {t("commitment.values.clarity.title")}
              </h3>
              <p className="text-[var(--text-subtle)]">
                {t("commitment.values.clarity.description")}
              </p>
            </div>

            <div className="p-[var(--space-lg)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)] text-center shadow-[var(--card-shadow)]">
              <div className="inline-flex p-4 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
                <CheckCircle className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-default)] mb-2">
                {t("commitment.values.resolution.title")}
              </h3>
              <p className="text-[var(--text-subtle)]">
                {t("commitment.values.resolution.description")}
              </p>
            </div>
          </div>
        </div>

        {/* Legal Footer */}
        <div className="text-center text-sm text-[var(--text-subtle)] border-t border-[var(--border-default)] pt-8">
          <p className="mb-2 font-semibold">{t("contactInfo.company.name")}</p>
          <p>{t("legal.disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}
