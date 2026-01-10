// saas-ux/i18n/request.ts
// Main config (loads translations)
import { getRequestConfig } from 'next-intl/server';
import { normalizeLocale } from '@/i18n/locales';

/**
 * next-intl configuration for App Router
 * 
 * Loads translations from multiple sources:
 * - Core translations from messages/{locale}.json
 * - Feature-specific translations from messages/{Feature}/{locale}.json
 * 
 * Easy to add new features - just add to the Promise.all array!
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // Normalize locale (handles en-US → en, pt-BR → pt, etc.)
  const raw = (await requestLocale) ?? 'en';
  const locale = normalizeLocale(raw);

  // Load all translation modules in parallel
  const [
    coreMessages,
    siteCockpitMessages,
    supportMessages,
    // Add more as you create them:
    // dashboardMessages,
    // settingsMessages,
    // i18nMessages,
    // chatbotMessages,
  ] = await Promise.all([
    import(`@/messages/${locale}.json`),
    import(`@/messages/SiteCockpit/${locale}.json`),
    import(`@/messages/Support/${locale}.json`),
    // import(`@/messages/Dashboard/${locale}.json`),
    // import(`@/messages/Settings/${locale}.json`),
    // import(`@/messages/i18n/${locale}.json`),
    // import(`@/messages/Chatbot/${locale}.json`),
  ]);

  return {
    locale,
    messages: {
      // Spread core/shared translations at root level
      ...coreMessages.default,

      // Add feature-specific translations under namespaces
      SiteCockpit: siteCockpitMessages.default.SiteCockpit,
      Support: supportMessages.default.Support,

      // Future features (uncomment as you add them):
      // Dashboard: dashboardMessages.default.Dashboard,
      // Settings: settingsMessages.default.Settings,
      // i18n: i18nMessages.default.i18n,
      // Chatbot: chatbotMessages.default.Chatbot,
    }
  };
});