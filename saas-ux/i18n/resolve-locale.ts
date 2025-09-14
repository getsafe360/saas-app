// saas-ux/i18n/resolve-locale.ts
import { cookies, headers } from 'next/headers';
import { normalizeLocale } from './locales';
import { getUser } from '@/lib/db/queries';

export async function resolveLocale(): Promise<string> {
  const user = await getUser();
  if (user?.language) return normalizeLocale(user.language);

  const cookieStore = await cookies();
  const cookie = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookie) return normalizeLocale(cookie);

  const headersList = await headers();
  const accept = headersList.get('accept-language');
  const guess = accept?.split(',').shift() || 'en';
  return normalizeLocale(guess);
}
