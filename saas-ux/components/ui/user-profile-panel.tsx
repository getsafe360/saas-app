'use client';

import { useUser } from "@clerk/clerk-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

export function UserProfilePanel({ plan, tokenBalance }: { plan?: string; tokenBalance?: number }) {
  const t = useTranslations('dashboard');
  const { user, isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return <div>{t('loading')}</div>;
  if (!isSignedIn) return <div>{t('greeting_anon')}</div>;

  const name =
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    t('greeting_anon');

  return (
<Card className="mb-8">
  <CardContent>
  <div className="flex items-center gap-5">
      <Avatar>
        <AvatarImage src={user?.imageUrl ?? ''} alt={name} />
        <AvatarFallback>{name[0]}</AvatarFallback>
      </Avatar>
      <div>
        <div className="text-xl font-semibold">{t('greeting', { name })}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">{user?.primaryEmailAddress?.emailAddress}</div>
        <div className="mt-2 flex gap-4 flex-wrap">
          <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-xs">
            {t('current_plan')}: {plan ?? 'Free'}
          </span>
          <span className="inline-block px-2 py-1 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 font-bold text-xs">
            {t('token_balance')}: {tokenBalance ?? 0}
          </span>
        </div>
      </div>
    </div>
    </CardContent>
  </Card>
  );
}
