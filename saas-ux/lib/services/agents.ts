// saas-ux/lib/services/agents.ts
import "server-only";

// keep category values in one place
export const CATEGORIES = ["seo", "performance", "accessibility", "security"] as const;
type Category = typeof CATEGORIES[number];

export type ScanIssue = {
  id: string;
  category: Category;
  title: string;
  severity: "low" | "medium" | "high";
  description: string;
  suggestion: string;
  fixAvailable: boolean;
  estTokens: number; // for the fix
};

export type ScanReport = {
  siteUrl: string;
  summary: {
    score: number; // 0-100 overall
    counts: Record<Category, number>;
    estTotalTokens: number;
  };
  issues: ScanIssue[];
  pagesAnalyzed: string[];
};

export async function callAgentsService(
  siteUrl: string,
  categories: Category[]
): Promise<{ report: ScanReport; agentUsed: "external" | "fallback" }> {
  const base = process.env.AGENTS_BASE_URL;
  const key = process.env.AGENTS_API_KEY;

  // try external agents first if configured
  if (base && key) {
    try {
      const r = await fetch(`${base.replace(/\/$/, "")}/analyze`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ siteUrl, categories }),
      });
      if (r.ok) {
        const report = (await r.json()) as ScanReport;
        return { report, agentUsed: "external" };
      }
    } catch {
      // fall through to fallback
    }
  }

  // --- Fallback heuristic (quick + deterministic) ---
  const pagesAnalyzed = [siteUrl];

  const issues = [
    {
      id: "meta-description-missing",
      category: "seo",
      title: "Missing or weak meta description",
      severity: "medium", // literal union
      description:
        "Your homepage likely lacks a compelling meta description, reducing CTR from search.",
      suggestion:
        "Add a 150–160 char description including primary keyword and value prop.",
      fixAvailable: true,
      estTokens: 800,
    },
    {
      id: "no-aria-labels",
      category: "accessibility",
      title: "Links or buttons missing accessible labels",
      severity: "high",
      description:
        "Some interactive elements may lack descriptive ARIA labels for screen readers.",
      suggestion:
        "Add aria-label or discernible text to all actionable controls.",
      fixAvailable: true,
      estTokens: 1200,
    },
    {
      id: "unused-css",
      category: "performance",
      title: "Render-blocking or unused CSS",
      severity: "medium",
      description:
        "Large CSS may delay first paint and contains unused selectors.",
      suggestion:
        "Inline critical CSS, defer the rest; purge unused classes in build.",
      fixAvailable: true,
      estTokens: 1500,
    },
    {
      id: "outdated-plugins",
      category: "security",
      title: "Potentially outdated dependencies",
      severity: "high",
      description:
        "Plugins/themes may be outdated, increasing vulnerability risk.",
      suggestion:
        "Update critical plugins/themes; enable auto-updates for trusted vendors.",
      fixAvailable: false,
      estTokens: 0,
    },
  ] as const;
  const filteredIssues: ScanIssue[] = (issues as readonly ScanIssue[]).filter((i) =>
    categories.includes(i.category)
  );
  const counts = filteredIssues.reduce(
    (acc, i) => {
      acc[i.category] = (acc[i.category] ?? 0) + 1;
      return acc;
    },
    {} as Record<Category, number>
  );
  const estTotalTokens = filteredIssues.reduce((s, i) => s + i.estTokens, 0);

  return {
    agentUsed: "fallback",
    report: {
      siteUrl,
      summary: { score: 72, counts, estTotalTokens },
      issues: filteredIssues,
      pagesAnalyzed,
    },
  };
  // If all else fails, throw an error to satisfy the return type
  throw new Error("Failed to generate scan report.");
}

