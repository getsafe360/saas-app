// saas-ux/app/[locale]/(dashboard)/contact/page.tsx
import { useTranslations } from "next-intl";
import { Mail, CreditCard, Shield, AlertCircle } from "lucide-react";
export default function ContactPage() {
  const t = useTranslations("Support");

  return (
    <div className="max-w-full px-4 sm:px-6 lg:px-8 min-h-64 md:min-h-80">
      {/* Hero Section */}
      <div className="text-[var(--text-default)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-5xl font-bold mb-4">{t("contactInfo.title")}</h1>
        </div>
      </div>

      {/* Contact Information */}
      <div className="mb-16 p-[var(--card-padding)] rounded-[var(--card-radius)] bg-[var(--card-bg)] border border-[var(--card-border)]">
        <h2 className="text-2xl font-bold text-[var(--text-default)] mb-6"></h2>

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-[var(--text-default)] mb-2">
            {t("contactInfo.company.name")}
          </h3>
          <p className="text-[var(--text-subtle)]">
            {t("contactInfo.company.description")}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 rounded-[var(--radius-md)] bg-[var(--card-bg)] border border-[var(--card-border)]">
            <Mail className="h-5 w-5 text-[var(--text-primary)] mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--text-subtle)]">
                {t("contactInfo.email.supportLabel")}
              </p>
              <a
                href="mailto:support@getsafe360.ai"
                className="text-[var(--text-primary)] hover:underline font-mono"
              >
                {t("contactInfo.email.support")}
              </a>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-[var(--radius-md)] bg-[var(--card-bg)] border border-[var(--card-border)]">
            <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--text-subtle)]">
                {t("contactInfo.email.billingLabel")}
              </p>
              <a
                href="mailto:support@getsafe360.ai"
                className="text-[var(--text-primary)] hover:underline font-mono"
              >
                {t("contactInfo.email.billing")}
              </a>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-[var(--radius-md)] bg-red-50 dark:bg-red-500/5">
            <AlertCircle className="h-5 w-5 text-[var(--color-danger)] mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--text-subtle)]">
                {t("contactInfo.email.securityLabel")}
              </p>
              <a
                href="mailto:security@getsafe360.ai"
                className="text-[var(--text-primary)] hover:underline font-mono"
              >
                {t("contactInfo.email.security")}
              </a>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-[var(--radius-md)] bg-[var(--card-bg)] border border-[var(--card-border)]">
            <Shield className="h-5 w-5 text-[var(--text-subtle)] mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--text-subtle)]">
                {t("contactInfo.email.legalLabel")}
              </p>
              <a
                href="mailto:legal@getsafe360.ai"
                className="text-[var(--text-primary)] hover:underline font-mono"
              >
                {t("contactInfo.email.legal")}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 rounded-[var(--radius-md)] bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--text-subtle)]">
              {t("contactInfo.emergencyNote")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
