// app/[locale]/(dashboard)/dashboard/settings/branding/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { findCurrentUserTeam } from "@/lib/auth/current";
import { canUseWhiteLabel, isPlanName } from "@/lib/plans/config";
import { BrandingSettings } from "@/components/reports/BrandingSettings";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Reports.branding" });
  return { title: t("title"), robots: { index: false } };
}

export default async function BrandingPage() {
  const team = await findCurrentUserTeam();
  const allowed = !!team && canUseWhiteLabel(isPlanName(team.planName) ? team.planName : "free");
  return <BrandingSettings allowed={allowed} />;
}
