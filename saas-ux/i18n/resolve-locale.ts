// saas-ux/i18n/resolve-locale.ts
import 'server-only';
import { cookies, headers } from 'next/headers';
import { normalizeLocale } from './locales';
import { getUser } from '@/lib/db/queries';

// Extend the inferred return with an optional language field
type MaybeUserWithLang = Awaited<ReturnType<typeof getUser>> & {
  language?: string | null;
};

export async function resolveLocale(): Promise<string> {
  const user = (await getUser()) as MaybeUserWithLang;
  if (user && typeof user.language === 'string' && user.language) {
    return normalizeLocale(user.language);
  }

  const cookieStore = await cookies();
  const cookie = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookie) return normalizeLocale(cookie);

  const headersList = await headers();
  const accept = headersList.get('accept-language') || '';
  const guess = accept.split(',')[0] || 'en';

  return normalizeLocale(guess);
}
