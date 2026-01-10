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
  PhoneOff,
  Lightbulb,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export default function SupportPage() {
  const t = useTranslations("Support");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-600/20 dark:to-purple-600/20 border-b border-blue-500/20 dark:border-gray-700/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h1 className="text-5xl font-bold text-white mb-4">
            {t("hero.title")}
          </h1>
          <p className="text-xl text-blue-50 dark:text-gray-300 max-w-2xl">
            {t("hero.subtitle")}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Contact Methods */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Email Support */}
          <div className="p-8 rounded-2xl bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t("contactMethods.email.title")}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("contactMethods.email.description")}
                </p>
              </div>
            </div>
            <a
              href="mailto:support@getsafe360.ai"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
            >
              <Mail className="h-5 w-5" />
              {t("contactMethods.email.action")}
            </a>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 font-mono">
              {t("contactMethods.email.address")}
            </p>
          </div>

          {/* Response Time */}
          <div className="p-8 rounded-2xl bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <Clock className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t("contactMethods.responseTime.title")}
                </h3>
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-3">
              {t("contactMethods.responseTime.primary")}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("contactMethods.responseTime.secondary")}
            </p>
          </div>
        </div>

        {/* No Phone Support Notice */}
        <div className="mb-16 p-6 rounded-xl bg-amber-50 dark:bg-gray-800/40 border border-amber-200 dark:border-gray-700/50">
          <div className="flex items-start gap-4">
            <PhoneOff className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-gray-700 dark:text-gray-300">
              {t("noPhone.message")}
            </p>
          </div>
        </div>

        {/* How We Can Help */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            {t("whatWeHelp.title")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Account */}
            <div className="p-6 rounded-xl bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t("whatWeHelp.categories.account.title")}
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("whatWeHelp.categories.account.description")}
              </p>
            </div>

            {/* Billing */}
            <div className="p-6 rounded-xl bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t("whatWeHelp.categories.billing.title")}
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("whatWeHelp.categories.billing.description")}
              </p>
            </div>

            {/* Technical */}
            <div className="p-6 rounded-xl bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Wrench className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t("whatWeHelp.categories.technical.title")}
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("whatWeHelp.categories.technical.description")}
              </p>
            </div>

            {/* Security */}
            <div className="p-6 rounded-xl bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t("whatWeHelp.categories.security.title")}
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("whatWeHelp.categories.security.description")}
              </p>
            </div>

            {/* General */}
            <div className="p-6 rounded-xl bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 shadow-sm col-span-1 md:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <MessageCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t("whatWeHelp.categories.general.title")}
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("whatWeHelp.categories.general.description")}
              </p>
            </div>
          </div>
        </div>

        {/* Billing Information - Stripe Compliance */}
        <div className="mb-16 p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/5 dark:to-cyan-500/5 border border-blue-200 dark:border-blue-500/20">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <CreditCard className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t("billingSection.title")}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {t("billingSection.description")}
              </p>
            </div>
          </div>

          <ul className="space-y-3 mb-6">
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">
                {t("billingSection.requirements.item1")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">
                {t("billingSection.requirements.item2")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">
                {t("billingSection.requirements.item3")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">
                {t("billingSection.requirements.item4")}
              </span>
            </li>
          </ul>

          <div className="p-4 rounded-lg bg-white/50 dark:bg-gray-800/30 border border-blue-200/50 dark:border-gray-700/50 mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">Note:</strong>{" "}
              {t("billingSection.note")}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t("billingSection.stripeInfo")}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t("billingSection.refundPolicy")}
            </p>
          </div>
        </div>

        {/* Product Feedback Section */}
        <div className="mb-16 p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-500/5 dark:to-pink-500/5 border border-purple-200 dark:border-purple-500/20">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <Lightbulb className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t("feedback.title")}
              </h2>
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                {t("feedback.subtitle")}
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {t("feedback.description")}
              </p>
            </div>
          </div>

          <p className="font-semibold text-gray-900 dark:text-white mb-3">
            {t("feedback.encourage")}
          </p>
          <ul className="space-y-2 mb-6">
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400 mt-2 flex-shrink-0"></div>
              <span className="text-gray-700 dark:text-gray-300">
                {t("feedback.items.item1")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400 mt-2 flex-shrink-0"></div>
              <span className="text-gray-700 dark:text-gray-300">
                {t("feedback.items.item2")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400 mt-2 flex-shrink-0"></div>
              <span className="text-gray-700 dark:text-gray-300">
                {t("feedback.items.item3")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400 mt-2 flex-shrink-0"></div>
              <span className="text-gray-700 dark:text-gray-300">
                {t("feedback.items.item4")}
              </span>
            </li>
          </ul>

          <div className="p-4 rounded-lg bg-white/50 dark:bg-gray-800/30 border border-purple-200/50 dark:border-gray-700/50">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong className="text-gray-900 dark:text-white">
                Our commitment:
              </strong>{" "}
              {t("feedback.commitment")}
            </p>
          </div>
        </div>

        {/* Our Commitment */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            {t("commitment.title")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 text-center shadow-sm">
              <div className="inline-flex p-4 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
                <Clock className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {t("commitment.values.response.title")}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t("commitment.values.response.description")}
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 text-center shadow-sm">
              <div className="inline-flex p-4 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
                <MessageCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {t("commitment.values.clarity.title")}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t("commitment.values.clarity.description")}
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 text-center shadow-sm">
              <div className="inline-flex p-4 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
                <CheckCircle className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {t("commitment.values.resolution.title")}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t("commitment.values.resolution.description")}
              </p>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="mb-16 p-8 rounded-2xl bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {t("contactInfo.title")}
          </h2>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t("contactInfo.company.name")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t("contactInfo.company.description")}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t("contactInfo.email.supportLabel")}
                </p>
                <a
                  href="mailto:support@getsafe360.ai"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                >
                  {t("contactInfo.email.support")}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t("contactInfo.email.billingLabel")}
                </p>
                <a
                  href="mailto:support@getsafe360.ai"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                >
                  {t("contactInfo.email.billing")}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg bg-red-50 dark:bg-red-500/5">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t("contactInfo.email.securityLabel")}
                </p>
                <a
                  href="mailto:security@getsafe360.ai"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                >
                  {t("contactInfo.email.security")}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <Shield className="h-5 w-5 text-gray-600 dark:text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t("contactInfo.email.legalLabel")}
                </p>
                <a
                  href="mailto:legal@getsafe360.ai"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                >
                  {t("contactInfo.email.legal")}
                </a>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t("contactInfo.emergencyNote")}
              </p>
            </div>
          </div>
        </div>

        {/* Legal Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700/50 pt-8">
          <p className="mb-2 font-semibold">
            {t("contactInfo.company.name")}
          </p>
          <p>{t("legal.disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}
