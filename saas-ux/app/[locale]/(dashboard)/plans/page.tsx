import { findCurrentUserTeam } from '@/lib/auth/current';
import { getPricingSignals } from '@/lib/usage/token-transactions';
import { PlansPageContent } from '@/components/pricing/plans-page';

export default async function PlansPage() {
  const team = await findCurrentUserTeam();
  const signals = team ? await getPricingSignals(team.id) : null;

  return (
    <PlansPageContent
      state={{
        isLoggedIn: Boolean(team),
        currentPlan: signals?.planName ?? null,
        shouldSuggestProUpgrade: signals?.shouldSuggestProUpgrade ?? false,
        showLowTokenBanner: signals?.showLowTokenBanner ?? false,
      }}
    />
  );
}
