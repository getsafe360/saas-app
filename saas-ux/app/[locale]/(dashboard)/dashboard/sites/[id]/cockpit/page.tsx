// saas-ux/app/[locale]/(dashboard)/dashboard/sites/[id]/cockpit/page.tsx
import { getDb } from "@/lib/db/drizzle";
import { sites } from "@/lib/db/schema/sites";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteCockpit } from "@/components/site-cockpit/SiteCockpit";
import { transformToSiteCockpitResponse } from "@/lib/cockpit/transform-api-data";
import type { SiteCockpitResponse } from "@/types/site-cockpit";
import type { ConnectionStatus } from "@/components/site-cockpit/cards/wordpress/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LOCALE = "en";

function toConnectionStatus(value: unknown): ConnectionStatus {
  if (
    value === "connected" ||
    value === "disconnected" ||
    value === "reconnecting" ||
    value === "error" ||
    value === "pending"
  ) {
    return value;
  }

  return "disconnected";
}


// ============================================
// Metadata Generation
// ============================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: "SiteCockpit" });

  // Get site info from DB
  let siteUrl: string | null = null;
  try {
    const db = getDb();
    const [row] = await db
      .select({ siteUrl: sites.siteUrl })
      .from(sites)
      .where(eq(sites.id, id))
      .limit(1);
    siteUrl = row?.siteUrl ?? null;
  } catch {
    // ignore DB errors in metadata
  }

  const title = siteUrl ? t("title", { url: siteUrl }) : t("notFoundTitle");
  const description = siteUrl
    ? t("description", { url: siteUrl })
    : t("notFoundDescription");

  const path = `/dashboard/sites/${id}/cockpit`;
  const canonicalPath = locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalPath,
    },
    alternates: {
      canonical: canonicalPath,
    },
  };
}

// ============================================
// Data Fetching Helpers
// ============================================

async function getSiteFromDB(id: string) {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(sites)
      .where(eq(sites.id, id))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

async function getSiteAnalysis(
  siteUrl: string
): Promise<SiteCockpitResponse | null> {
  try {
    // Dynamically construct the base URL from request headers
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const forwardedProto = headersList.get("x-forwarded-proto");
    const protocol = forwardedProto || (host.includes("localhost") ? "http" : "https");
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(
      `${baseUrl}/api/analyze-facts?url=${encodeURIComponent(siteUrl)}`,
      {
        cache: "no-store",
        headers: {
          "User-Agent": "SiteCockpit/1.0",
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch site analysis:", response.status);
      return null;
    }

    const data = await response.json();

    // 🐛 DEBUG: Log the raw API data
    console.log("🔍 Raw API data keys:", Object.keys(data));
    console.log(
      "🔍 API data sample:",
      JSON.stringify(data, null, 2).slice(0, 500)
    );

    const transformed = transformToSiteCockpitResponse(data);

    // 🐛 DEBUG: Log the transformed data structure
    console.log("🔍 Transformed data keys:", Object.keys(transformed));
    console.log(
      "🔍 Performance data:",
      JSON.stringify(transformed.performance, null, 2)
    );
    console.log(
      "🔍 Security data:",
      JSON.stringify(transformed.security, null, 2)
    );

    return transformed;
  } catch (error) {
    console.error("Error fetching site analysis:", error);
    return null;
  }
}

// ============================================
// Main Page Component
// ============================================

export default async function SiteCockpitPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: "SiteCockpit" });

  // Get site from database
  const site = await getSiteFromDB(id);
  if (!site) {
    return notFound();
  }

  // Fetch analysis data
  const analysisData = await getSiteAnalysis(site.siteUrl);
  if (!analysisData) {
    return (
      <div className="p-6">
        <div className="rounded-lg border p-6 bg-yellow-50 text-yellow-800">
          <h2 className="text-lg font-semibold mb-2">
            {t("analysisUnavailable")}
          </h2>
          <p className="text-sm">{t("analysisUnavailableDescription")}</p>
        </div>
      </div>
    );
  }

  // 🐛 DEBUG: Log right before rendering
  console.log(
    "🎯 About to render SiteCockpit with data keys:",
    Object.keys(analysisData)
  );

  return (
    <SiteCockpit
      data={analysisData}
      siteId={id}
      editable={false}
      wordpressOnly={true}
      wordpressConnectionStatus={toConnectionStatus(site.connectionStatus)}
      wordpressLastConnected={site.lastConnectedAt?.toISOString()}
    />
  );
}
