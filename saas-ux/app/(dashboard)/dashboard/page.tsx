'use client';

import { UserProfilePanel } from '@/components/ui/user-profile-panel';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

// Dummy data for plan/token; replace with real DB values!
const userPlan = 'Free';
const tokenBalance = 20;

export default function DashboardHome() {
  const t = useTranslations('dashboard');
  const [someState, setSomeState] = useState(false);

  return (
    <section className="flex-1 p-4 lg:p-8">
      <UserProfilePanel plan={userPlan} tokenBalance={tokenBalance} />

      {/* Onboarding / Welcome Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold my-4">{t('welcome_headline')}</h2>
        <p className="text-base text-gray-700 dark:text-gray-300 mb-4">
          {t('welcome_text')}
        </p>
        <div className="flex flex-wrap gap-4">
          <Button asChild variant="outline" className="rounded-xl font-semibold">
            <a href="/dashboard/sites">{t('add_website')}</a>
          </Button>
          <Button asChild variant="outline" className="rounded-xl font-semibold">
            <a href="/dashboard/analysis">{t('run_analysis')}</a>
          </Button>
        </div>
      </div>

      {/* Roadmap for next onboarding steps, visually grouped */}      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No team members yet.</p>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-[--thin-border] p-4">
          <h3 className="font-bold mb-1">{t('feature_1_headline')}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('feature_1_desc')}</p>
        </div>
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-[--thin-border] p-4">
          <h3 className="font-bold mb-1">{t('feature_2_headline')}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('feature_2_desc')}</p>
        </div>
        {/* Add more feature cards as needed */}
      </div>
    </section>
  );
}
