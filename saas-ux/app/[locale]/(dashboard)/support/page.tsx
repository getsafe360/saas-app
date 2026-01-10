// app/[locale]/support/page.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Mail,
  FileText,
  Clock,
  User,
  CreditCard,
  Wrench,
  Shield,
  MessageCircle,
  Lightbulb,
  CheckCircle,
  Send,
  Loader2,
  AlertCircle,
  Phone,
  PhoneOff,
} from "lucide-react";

export default function SupportPage() {
  const t = useTranslations("Support");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    category: "",
    message: "",
    accountEmail: "",
    referenceNumber: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to send");

      setSubmitStatus("success");
      setFormData({
        name: "",
        email: "",
        subject: "",
        category: "",
        message: "",
        accountEmail: "",
        referenceNumber: "",
      });
    } catch (error) {
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h1 className="text-4xl font-bold text-white mb-4">
            {t("hero.title")}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl">
            {t("hero.subtitle")}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Contact Methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Email */}
          <div className="p-6 rounded-xl bg-gray-800/40 border border-gray-700/50 hover:border-blue-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
                <Mail className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {t("contactMethods.email.title")}
              </h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {t("contactMethods.email.description")}
            </p>
            <a
              href="mailto:support@getsafe360.ai"
              className="text-blue-400 hover:text-blue-300 font-semibold text-sm"
            >
              {t("contactMethods.email.address")}
            </a>
          </div>

          {/* Form */}
          <div className="p-6 rounded-xl bg-gray-800/40 border border-gray-700/50 hover:border-purple-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-purple-500/20 border border-purple-500/30">
                <FileText className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {t("contactMethods.form.title")}
              </h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {t("contactMethods.form.description")}
            </p>
            <a
              href="#contact-form"
              className="text-purple-400 hover:text-purple-300 font-semibold text-sm"
            >
              {t("contactMethods.form.action")} →
            </a>
          </div>

          {/* Response Time */}
          <div className="p-6 rounded-xl bg-gray-800/40 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30">
                <Clock className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {t("contactMethods.responseTime.title")}
              </h3>
            </div>
            <p className="text-lg font-semibold text-green-400 mb-2">
              {t("contactMethods.responseTime.primary")}
            </p>
            <p className="text-sm text-gray-400">
              {t("contactMethods.responseTime.secondary")}
            </p>
          </div>
        </div>

        {/* No Phone Support Notice */}
        <div className="mb-12 p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
          <div className="flex items-start gap-3">
            <PhoneOff className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">{t("noPhone.message")}</p>
          </div>
        </div>

        {/* What We Help With */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">
            {t("whatWeHelp.title")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Account */}
            <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
              <div className="flex items-center gap-3 mb-2">
                <User className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold text-white">
                  {t("whatWeHelp.categories.account.title")}
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                {t("whatWeHelp.categories.account.description")}
              </p>
            </div>

            {/* Billing */}
            <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="h-5 w-5 text-green-400" />
                <h3 className="font-semibold text-white">
                  {t("whatWeHelp.categories.billing.title")}
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                {t("whatWeHelp.categories.billing.description")}
              </p>
            </div>

            {/* Technical */}
            <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
              <div className="flex items-center gap-3 mb-2">
                <Wrench className="h-5 w-5 text-purple-400" />
                <h3 className="font-semibold text-white">
                  {t("whatWeHelp.categories.technical.title")}
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                {t("whatWeHelp.categories.technical.description")}
              </p>
            </div>

            {/* Security */}
            <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="h-5 w-5 text-red-400" />
                <h3 className="font-semibold text-white">
                  {t("whatWeHelp.categories.security.title")}
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                {t("whatWeHelp.categories.security.description")}
              </p>
            </div>

            {/* General */}
            <div className="p-4 rounded-lg bg-gray-800/40 border border-gray-700/50">
              <div className="flex items-center gap-3 mb-2">
                <MessageCircle className="h-5 w-5 text-orange-400" />
                <h3 className="font-semibold text-white">
                  {t("whatWeHelp.categories.general.title")}
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                {t("whatWeHelp.categories.general.description")}
              </p>
            </div>
          </div>
        </div>

        {/* Billing Tip */}
        <div className="mb-12 p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
          <div className="flex items-start gap-3 mb-4">
            <CreditCard className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {t("billingTip.title")}
              </h3>
              <p className="text-sm text-gray-300 mb-3">
                {t("billingTip.description")}
              </p>
              <ul className="space-y-2 mb-3">
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-300"
                  >
                    <CheckCircle className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    {t(`Support.billingTip.items.${i}`)}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-400">{t("billingTip.footer")}</p>
            </div>
          </div>
        </div>

        {/* Product Feedback Section */}
        <div className="mb-12 p-8 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-lg bg-purple-500/20 border border-purple-500/30">
              <Lightbulb className="h-8 w-8 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {t("feedback.title")}
              </h2>
              <p className="text-lg text-gray-300 mb-4">
                {t("feedback.subtitle")}
              </p>
              <p className="text-gray-400 mb-4">{t("feedback.description")}</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 flex-shrink-0"></div>
                <p className="text-gray-300">
                  {t(`Support.feedback.questions.${i}`)}
                </p>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-400">{t("feedback.note")}</p>
        </div>

        {/* Contact Form */}
        <div id="contact-form" className="mb-12">
          <div className="p-8 rounded-xl bg-gray-800/40 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-2">
              {t("form.title")}
            </h2>
            <p className="text-gray-400 mb-8">{t("form.subtitle")}</p>

            {submitStatus === "success" ? (
              <div className="p-6 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  {t("form.success.title")}
                </h3>
                <p className="text-gray-300 mb-4">
                  {t("form.success.description")}
                </p>
                <button
                  onClick={() => setSubmitStatus("idle")}
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors"
                >
                  {t("form.success.action")}
                </button>
              </div>
            ) : submitStatus === "error" ? (
              <div className="p-6 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  {t("form.error.title")}
                </h3>
                <p className="text-gray-300 mb-4">
                  {t("form.error.description")}
                </p>
                <button
                  onClick={() => setSubmitStatus("idle")}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
                >
                  {t("form.error.action")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name & Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      {t("form.fields.name.label")} *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder={t("form.fields.name.placeholder")}
                      className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      {t("form.fields.email.label")} *
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder={t("form.fields.email.placeholder")}
                      className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t("form.fields.email.helper")}
                    </p>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    {t("form.fields.subject.label")} *
                  </label>
                  <input
                    type="text"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder={t("form.fields.subject.placeholder")}
                    className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    {t("form.fields.category.label")} *
                  </label>
                  <select
                    name="category"
                    required
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select a category</option>
                    <option value="account">
                      {t("form.fields.category.options.account")}
                    </option>
                    <option value="billing">
                      {t("form.fields.category.options.billing")}
                    </option>
                    <option value="technical">
                      {t("form.fields.category.options.technical")}
                    </option>
                    <option value="security">
                      {t("form.fields.category.options.security")}
                    </option>
                    <option value="feedback">
                      {t("form.fields.category.options.feedback")}
                    </option>
                    <option value="other">
                      {t("form.fields.category.options.other")}
                    </option>
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    {t("form.fields.message.label")} *
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={6}
                    value={formData.message}
                    onChange={handleChange}
                    placeholder={t("form.fields.message.placeholder")}
                    className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t("form.fields.message.helper")}
                  </p>
                </div>

                {/* Optional Fields for Billing */}
                {formData.category === "billing" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        {t("form.fields.accountEmail.label")}
                      </label>
                      <input
                        type="email"
                        name="accountEmail"
                        value={formData.accountEmail}
                        onChange={handleChange}
                        placeholder={t("form.fields.accountEmail.placeholder")}
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t("form.fields.accountEmail.helper")}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        {t("form.fields.referenceNumber.label")}
                      </label>
                      <input
                        type="text"
                        name="referenceNumber"
                        value={formData.referenceNumber}
                        onChange={handleChange}
                        placeholder={t(
                          "form.fields.referenceNumber.placeholder"
                        )}
                        className="w-full px-4 py-3 rounded-lg bg-gray-900/50 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t("form.fields.referenceNumber.helper")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-6 py-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold text-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t("form.submitting")}
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      {t("form.submit")}
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Our Commitment */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">
            {t("commitment.title")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="p-6 rounded-lg bg-gray-800/40 border border-gray-700/50"
              >
                <CheckCircle className="h-8 w-8 text-green-400 mb-4" />
                <h3 className="font-semibold text-white mb-2">
                  {t(`commitment.values.${i}.title`)}
                </h3>
                <p className="text-sm text-gray-400">
                  {t(`commitment.values.${i}.description`)}
                </p>
              </div>
            ))}
          </div>
          <p className="text-gray-400 text-center">{t("commitment.closing")}</p>
        </div>

        {/* Legal Footer */}
        <div className="text-center text-sm text-gray-500">
          <p className="mb-2">{t("legal.companyName")}</p>
          <p>{t("legal.disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}
