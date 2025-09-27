// app/[locale]/(dashboard)/dashboard/DashboardClient.tsx  (CLIENT)
'use client';
import { UserProfilePanel } from '@/components/ui/user-profile-panel';
import { useState } from 'react';
import { useRouter } from '@/navigation'; // your locale-aware router
import { Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // if you have one
import { useTranslations } from 'next-intl';

const userPlan = 'Free';
const tokenBalance = 20;

function AddSiteCard() {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/sites/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.error || 'failed');
      router.push(`/dashboard/sites/${j.siteId}?connected=1`);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to add site');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-3xl font-bold">{t('websites')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-base text-gray-700 dark:text-gray-300 mb-4">
          {t('welcome_text')}
        </p>

        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-3xl">
          <div className="flex-1 flex items-center gap-2">
            <Globe className="w-4 h-4 shrink-0" />
            <Input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <Button type="submit" disabled={busy} className="rounded-xl font-semibold">
            {t('add_website')}
          </Button>
        </form>

        {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardClient() {
  const t = useTranslations('dashboard');
  const [someState, setSomeState] = useState(false);
  const placeholder = "https://yourwebsite.com";
  const [value, setValue] = useState("");
  return (
    <section className="flex-1 p-4 lg:p-8">
      <UserProfilePanel plan={userPlan} tokenBalance={tokenBalance} />
      <div className="mb-8">
        <h2 className="text-2xl font-bold my-4">{t('welcome_headline')}</h2>
        <p className="text-base text-gray-700 dark:text-gray-300 mb-4">
          {t('welcome_text')}
        </p>
      </div>
      <AddSiteCard />
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No team members yet.</p>
        </CardContent>
      </Card>
    </section>
  );
}
