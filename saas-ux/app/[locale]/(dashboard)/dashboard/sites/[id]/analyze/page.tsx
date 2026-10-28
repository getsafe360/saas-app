// app/[locale]/(dashboard)/dashboard/sites/[id]/analyze/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOwnedSite } from "@/lib/auth/site-access";
import { getTranslations } from "next-intl/server";
import AnalyzeClient from "./AnalyzeClient";

const DEFAULT_LOCALE = "en";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;

  // Try to read siteUrl for a nicer title (owner only)
  let siteUrl: string | null = null;
  try {
    siteUrl = (await getOwnedSite(id))?.siteUrl ?? null;
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
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  if (!(await getOwnedSite(id))) notFound();
  return <AnalyzeClient />;
}
