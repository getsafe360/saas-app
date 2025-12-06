// app/[locale]/(dashboard)/dashboard/sites/[id]/analyze/page.tsx
import type { Metadata } from "next";
import { getDb } from "@/lib/db/drizzle";
import { sites } from "@/lib/db/schema/sites";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import AnalyzeClient from "./AnalyzeClient";

const DEFAULT_LOCALE = "en";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;

  // Try to read siteUrl for a nicer title
  const db = getDb();
  let siteUrl: string | null = null;
  try {
    const [row] = await db
      .select({ siteUrl: sites.siteUrl })
      .from(sites)
      .where(eq(sites.id, id))
      .limit(1);
    siteUrl = row?.siteUrl ?? null;
  } catch {}

  const t = await getTranslations("AnalyzeMeta");

  const title = siteUrl ? t("titleWithUrl", { url: siteUrl }) : t("title");
  const description = t("description");

  const path = `/dashboard/sites/${id}/analyze`;
  const canonical = locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
  };
}

// Keep this server component tiny; the UI sits in the client component.
export default function Page() {
  return <AnalyzeClient />;
}
