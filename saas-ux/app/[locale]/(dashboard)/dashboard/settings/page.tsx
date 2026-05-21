// app/[locale]/(dashboard)/dashboard/settings/page.tsx
import { UserProfile } from "@clerk/nextjs";
import { CreditCard, Zap, ExternalLink, TrendingUp } from "lucide-react";
import { getDbUserFromClerk, findCurrentUserTeam } from "@/lib/auth/current";
import { PLANS, type PlanName } from "@/lib/plans/config";
import { TOKEN_PACKS } from "@/config/billing/token-packs";

export const dynamic = "force-dynamic";

const STRIPE_PORTAL_URL =
  "https://buy.getsafe360.ai/p/login/8x214mfQud5mbNf84abAs00";

const PLAN_BADGE: Record<string, string> = {
  free: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  pro: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  agent: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  agency: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  business: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function TokenBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(1, used / total) : 0;
  const color =
    pct >= 1
      ? "bg-red-500"
      : pct >= 0.8
      ? "bg-amber-400"
      : "bg-sky-500";
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

export default async function SettingsPage() {
  const user = await getDbUserFromClerk();
  const team = await findCurrentUserTeam();

  const planKey = (team?.planName ?? "free") as PlanName;
  const plan = PLANS[planKey] ?? PLANS.free;

  const tokensIncluded = team?.tokensIncluded ?? 5000;
  const tokensPurchased = team?.tokensPurchased ?? 0;
  const tokensUsed = team?.tokensUsedThisMonth ?? 0;
  const tokensRemaining = team?.tokensRemaining ?? 0;
  const totalTokens = tokensIncluded + tokensPurchased;

  const billingReset = team?.billingCycleStart
    ? (() => {
        const d = new Date(team.billingCycleStart);
        d.setMonth(d.getMonth() + 1);
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      })()
    : null;

  const isPaidPlan = planKey !== "free";

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text-default)]">My Account</h1>

      {/* Plan & Token Usage */}
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--card-bg,white)] dark:bg-gray-900 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/30">
            <TrendingUp className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-default)]">Plan &amp; Usage</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Current billing period</p>
          </div>
        </div>

        {/* Plan badge + features */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
              PLAN_BADGE[planKey] ?? PLAN_BADGE.free
            }`}
          >
            {plan.displayName} Plan
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {plan.priceDisplay}/month
          </span>
          {team?.subscriptionStatus && team.subscriptionStatus !== "active" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-medium">
              {team.subscriptionStatus}
            </span>
          )}
        </div>

        {/* Token usage */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-default)] font-medium">Token usage this month</span>
            <span className="text-gray-500 dark:text-gray-400">
              {tokensUsed.toLocaleString()} / {totalTokens.toLocaleString()}
            </span>
          </div>
          <TokenBar used={tokensUsed} total={totalTokens} />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{tokensRemaining.toLocaleString()} remaining</span>
            {billingReset && <span>Resets {billingReset}</span>}
          </div>
        </div>

        {/* Breakdown */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
          {[
            { label: "Included in plan", value: tokensIncluded.toLocaleString() },
            { label: "Top-ups purchased", value: tokensPurchased.toLocaleString() },
            { label: "Remaining", value: tokensRemaining.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
              <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
              <dd className="mt-1 text-lg font-semibold text-[var(--text-default)]">{value}</dd>
            </div>
          ))}
        </dl>

        {/* CTA */}
        <div className="pt-1 flex flex-wrap gap-3">
          {isPaidPlan ? (
            <a
              href={STRIPE_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
            >
              Manage Subscription
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors"
            >
              Upgrade Plan
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {isPaidPlan && (
            <a
              href={STRIPE_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-default)] text-sm font-medium text-[var(--text-default)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel Subscription
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </section>

      {/* Token top-ups */}
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--card-bg,white)] dark:bg-gray-900 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-default)]">Token Top-ups</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">One-time purchases — tokens never expire</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TOKEN_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative rounded-xl border p-4 space-y-2 ${
                pack.highlight === "best-value"
                  ? "border-sky-400 dark:border-sky-600 bg-sky-50 dark:bg-sky-950/30"
                  : "border-[var(--border-default)]"
              }`}
            >
              {pack.highlight === "best-value" && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500 text-white">
                  Best value
                </span>
              )}
              <p className="font-semibold text-[var(--text-default)]">{pack.name}</p>
              <p className="text-2xl font-bold text-[var(--text-default)]">€{pack.priceEur}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pack.tokens.toLocaleString()} tokens
              </p>
              <a
                href={pack.stripeCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block w-full text-center px-3 py-2 rounded-lg bg-[var(--text-default)] text-[var(--background-default)] text-sm font-medium hover:opacity-80 transition-opacity"
              >
                Buy
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Billing portal shortcut */}
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--card-bg,white)] dark:bg-gray-900 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-default)]">Billing</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Invoices, payment methods, and history</p>
          </div>
        </div>
        <a
          href={STRIPE_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-default)] text-sm font-medium text-[var(--text-default)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Open Billing Portal
          <ExternalLink className="h-4 w-4" />
        </a>
      </section>

      {/* Profile */}
      <section className="rounded-xl overflow-hidden border border-[var(--border-default)]">
        <UserProfile
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-none border-0",
            },
          }}
        />
      </section>
    </div>
  );
}
