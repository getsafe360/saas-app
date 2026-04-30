// app/[locale]/(dashboard)/dashboard/sites/[id]/seo-analysis/page.tsx
// Full-page SEO GEO Analysis report — streams live findings in a tabbed layout.

import "server-only";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/drizzle";
import { sites } from "@/lib/db/schema/sites";
import { eq } from "drizzle-orm";
import { SEOAnalysisPage } from "@/components/site-cockpit/cards/seo/SEOAnalysisPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSite(id: string) {
  try {
    const db = getDb();
    const [row] = await db
      .select({ id: sites.id, siteUrl: sites.siteUrl })
      .from(sites)
      .where(eq(sites.id, id))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export default async function SeoAnalysisPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const { locale, id } = await params;
  const { start } = await searchParams;

  const site = await getSite(id);
  if (!site) return notFound();

  return (
    <SEOAnalysisPage
      siteId={id}
      siteUrl={site.siteUrl}
      locale={locale}
      autoStart={start === "true"}
    />
  );
}
