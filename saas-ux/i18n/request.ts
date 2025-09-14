import {getRequestConfig} from 'next-intl/server';
import {normalizeLocale} from '@/i18n/locales';

// next-intl looks for this file automatically in App Router projects.
// It wires up server helpers like getTranslations/getLocale.
export default getRequestConfig(async ({requestLocale}) => {
  const raw = (await requestLocale) ?? 'en';
  const locale = normalizeLocale(raw);
  const messages = (await import(`@/messages/${locale}.json`)).default;

  return {
    locale,
    messages
  };
});