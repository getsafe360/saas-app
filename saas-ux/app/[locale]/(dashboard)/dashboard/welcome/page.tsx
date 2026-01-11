// app/(dashboard)/dashboard/welcome/page.tsx
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { WelcomeClient } from "./WelcomeClient";
import { getDb } from "@/lib/db/drizzle";
import { sites } from "@/lib/db/schema/sites";
import { users } from "@/lib/db/schema/auth/users";
import { eq } from "drizzle-orm";
import type { StashedTestResult } from "@/lib/stash/types";

export const runtime = "nodejs";

async function fetchStashViaUrl(publicUrl: string): Promise<StashedTestResult | null> {
  try {
    const r = await fetch(publicUrl, { cache: "no-store" });
    if (!r.ok) return null;
    const data = await r.json();
    return data as StashedTestResult;
  } catch (error) {
    console.error("Failed to fetch stash:", error);
    return null;
  }
}

function buildPublicUrlFromKey(key: string) {
  const base =
    process.env.NEXT_PUBLIC_BLOB_BASE_URL || process.env.BLOB_PUBLIC_BASE;
  if (!base) return null;
  return new URL(key, base).toString();
}

async function getAppUserId(clerkUserId: string): Promise<number | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);
    return row?.id ?? null;
  } catch (error) {
    console.error("Failed to get app user ID:", error);
    return null;
  }
}

async function saveSiteToDatabase(
  appUserId: number,
  stash: StashedTestResult
): Promise<string | null> {
  try {
    const db = getDb();
    const siteId = crypto.randomUUID();

    // Extract domain from URL
    const domain = new URL(stash.url).hostname;

    await db.insert(sites).values({
      id: siteId,
      siteUrl: stash.url,
      userId: appUserId,
      status: "connected",
      cms: stash.facts?.cms?.type || null,
      lastScores: stash.scores ? JSON.stringify(stash.scores) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // Also save to blob storage for quick access
    const { put } = await import("@vercel/blob");
    const blobKey = `sites/${siteId}.json`;
    await put(
      blobKey,
      JSON.stringify({
        siteId,
        siteUrl: stash.url,
        userId: appUserId,
        status: "connected",
        scores: stash.scores,
        faviconUrl: stash.facts?.faviconUrl,
        cms: stash.facts?.cms,
        findings: stash.findings,
        createdAt: Date.now(),
      }),
      { access: "public", contentType: "application/json" }
    );

    return siteId;
  } catch (error) {
    console.error("Failed to save site to database:", error);
    return null;
  }
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ stash?: string; u?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Get app user ID from Clerk ID
  const appUserId = await getAppUserId(user.id);
  if (!appUserId) {
    console.error("Failed to get app user ID");
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const stashKey = sp?.stash;
  const stashUrl = sp?.u;

  if (!stashKey && !stashUrl) {
    redirect("/dashboard/sites?first=1");
  }

  // Retrieve stash
  let stash: StashedTestResult | null = null;
  if (stashUrl) {
    stash = await fetchStashViaUrl(stashUrl);
  } else if (stashKey) {
    const composed = buildPublicUrlFromKey(stashKey);
    if (composed) {
      stash = await fetchStashViaUrl(composed);
    }
  }

  if (!stash) {
    redirect("/dashboard/sites?first=1");
  }

  // Save site to database
  const siteId = await saveSiteToDatabase(appUserId, stash);
  if (!siteId) {
    console.error("Failed to create site");
    redirect("/dashboard/sites?first=1");
  }

  // Extract quick wins from findings
  const quickWins = stash.findings
    .filter((f) => f.severity === "critical" || f.severity === "medium")
    .slice(0, 10)
    .map((f) => ({
      title: f.title,
      impact: f.severity === "critical" ? "critical" as const : "high" as const,
      effort: "low" as const, // Simplified for now
      scoreIncrease: 2,
    }));

  // Extract domain from URL
  const domain = new URL(stash.url).hostname;

  // Prepare data for client component
  const welcomeData = {
    url: stash.url,
    domain,
    faviconUrl: stash.facts?.faviconUrl || undefined,
    overallScore: stash.scores?.overall || 0,
    categoryScores: {
      performance: stash.scores?.perf,
      security: stash.scores?.sec,
      seo: stash.scores?.seo,
      accessibility: stash.scores?.a11y,
      wordpress: stash.facts?.cms?.type === "wordpress" ? stash.scores?.overall : undefined,
    },
    quickWinsCount: stash.quickWinsCount || quickWins.length,
    potentialScoreIncrease: stash.potentialScoreIncrease || quickWins.length * 2,
    quickWins,
    siteId,
  };

  return <WelcomeClient data={welcomeData} />;
}
