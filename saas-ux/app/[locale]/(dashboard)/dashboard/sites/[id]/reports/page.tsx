// app/[locale]/(dashboard)/dashboard/sites/[id]/reports/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getOwnedSite } from "@/lib/auth/site-access";
import { getOwnerPlan } from "@/lib/plans/owner-plan";
import { canGenerateReports, canUseWhiteLabel } from "@/lib/plans/config";
import { SiteReports } from "@/components/reports/SiteReports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hostOf(site: { canonicalHost: string | null; siteUrl: string }): string {
  if (site.canonicalHost) return site.canonicalHost.replace(/^www\./, "");
  try {
    return new URL(site.siteUrl).hostname.replace(/^www\./, "");
  } catch {
    return site.siteUrl;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Reports.page" });
  const site = await getOwnedSite(id).catch(() => null);
  return { title: site ? `${t("title")} · ${hostOf(site)}` : t("title"), robots: { index: false } };
}

export default async function SiteReportsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const site = await getOwnedSite(id);
  if (!site) return notFound();
  const plan = await getOwnerPlan(site.userId ?? null);

  return (
    <SiteReports
      siteId={id}
      host={hostOf(site)}
      canReport={canGenerateReports(plan)}
      canWhiteLabel={canUseWhiteLabel(plan)}
    />
  );
}
