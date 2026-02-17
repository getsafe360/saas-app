// components/site-cockpit/cards/wordpress/utils/healthEngine.ts

import type {
  ImpactLevel,
  WordPress,
  WordPressCategoryScores,
  WordPressHealthCategory,
  WordPressHealthFinding,
} from "@/types/site-cockpit";

type FindingInput = {
  id: string;
  category: WordPressHealthCategory;
  title: string;
  description: string;
  severity: ImpactLevel;
  failed: boolean;
  warning?: boolean;
  action: string;
  remediationActionId: string;
  automationLevel?: "auto" | "guided" | "manual";
};

const SCORE_WEIGHTS: Record<WordPressHealthCategory, number> = {
  security: 0.35,
  performance: 0.2,
  stability: 0.2,
  "seo-ux": 0.15,
  "red-flags": 0.1,
};

function severityPenalty(severity: ImpactLevel): number {
  switch (severity) {
    case "critical":
      return 30;
    case "high":
      return 20;
    case "medium":
      return 10;
    default:
      return 4;
  }
}

export function calculateWordPressCategoryScores(
  findings: WordPressHealthFinding[],
): WordPressCategoryScores {
  const byCategory: Record<WordPressHealthCategory, WordPressHealthFinding[]> = {
    security: [],
    performance: [],
    stability: [],
    "seo-ux": [],
    "red-flags": [],
  };

  findings.forEach((finding) => {
    byCategory[finding.category].push(finding);
  });

  const base = 100;
  const scoreForCategory = (categoryFindings: WordPressHealthFinding[]) => {
    let score = base;
    categoryFindings.forEach((finding) => {
      if (finding.status === "fail") {
        score -= severityPenalty(finding.severity);
      } else if (finding.status === "warning") {
        score -= Math.round(severityPenalty(finding.severity) / 2);
      }
    });
    return Math.max(0, Math.min(100, score));
  };

  return {
    security: scoreForCategory(byCategory.security),
    performance: scoreForCategory(byCategory.performance),
    stability: scoreForCategory(byCategory.stability),
    "seo-ux": scoreForCategory(byCategory["seo-ux"]),
    "red-flags": scoreForCategory(byCategory["red-flags"]),
  };
}

export function calculateWordPressWeightedScore(scores: WordPressCategoryScores): number {
  const weighted =
    scores.security * SCORE_WEIGHTS.security +
    scores.performance * SCORE_WEIGHTS.performance +
    scores.stability * SCORE_WEIGHTS.stability +
    scores["seo-ux"] * SCORE_WEIGHTS["seo-ux"] +
    scores["red-flags"] * SCORE_WEIGHTS["red-flags"];

  return Math.max(0, Math.min(100, Math.round(weighted)));
}

export function buildWordPressHealthFindings(wordpress: WordPress): WordPressHealthFinding[] {
  const checks: FindingInput[] = [
    {
      id: "wp-core-version",
      category: "security",
      title: "WordPress core version",
      description: wordpress.version.outdated
        ? `Core is ${wordpress.version.daysOld} days behind latest release.`
        : "Core is up to date.",
      severity: wordpress.version.outdated ? "high" : "low",
      failed: wordpress.version.outdated,
      action: "Update WordPress core to the latest stable version.",
      remediationActionId: "wordpress-update-core",
      automationLevel: "guided",
    },
    {
      id: "wp-login-exposed",
      category: "security",
      title: "Login page protection",
      description: wordpress.security.defaultLoginExposed
        ? "Default login endpoint appears exposed."
        : "Login endpoint has basic protection.",
      severity: "medium",
      failed: wordpress.security.defaultLoginExposed,
      action: "Restrict /wp-login.php and add rate limiting + CAPTCHA.",
      remediationActionId: "wordpress-harden-login",
      automationLevel: "guided",
    },
    {
      id: "wp-user-enumeration",
      category: "security",
      title: "User enumeration",
      description: wordpress.security.userEnumerationBlocked
        ? "Public user enumeration appears blocked."
        : "Potential username enumeration detected.",
      severity: "high",
      failed: !wordpress.security.userEnumerationBlocked,
      action: "Block user archives/REST username leakage with WAF or plugin rules.",
      remediationActionId: "wordpress-block-user-enumeration",
      automationLevel: "auto",
    },
    {
      id: "wp-xmlrpc",
      category: "security",
      title: "XML-RPC exposure",
      description: wordpress.security.xmlrpcEnabled
        ? "XML-RPC endpoint is enabled."
        : "XML-RPC endpoint appears disabled.",
      severity: "medium",
      failed: wordpress.security.xmlrpcEnabled,
      action: "Disable or tightly restrict XML-RPC unless explicitly required.",
      remediationActionId: "wordpress-disable-xmlrpc",
      automationLevel: "auto",
    },
    {
      id: "wp-debug-mode",
      category: "stability",
      title: "WP debug mode",
      description: wordpress.security.wpDebugMode
        ? "Debug mode appears enabled in a production context."
        : "Debug mode appears disabled.",
      severity: "medium",
      failed: wordpress.security.wpDebugMode,
      action: "Set WP_DEBUG and WP_DEBUG_LOG to false on production.",
      remediationActionId: "wordpress-disable-debug",
      automationLevel: "guided",
    },
    {
      id: "wp-vulnerable-plugins",
      category: "security",
      title: "Known vulnerable plugins",
      description:
        wordpress.plugins.vulnerable > 0
          ? `${wordpress.plugins.vulnerable} vulnerable plugin(s) detected.`
          : "No known vulnerable plugins detected.",
      severity: wordpress.plugins.vulnerable > 0 ? "critical" : "low",
      failed: wordpress.plugins.vulnerable > 0,
      action: "Patch, replace, or remove vulnerable plugins immediately.",
      remediationActionId: "wordpress-remediate-vulnerable-plugins",
      automationLevel: "guided",
    },
    {
      id: "wp-outdated-plugins",
      category: "stability",
      title: "Outdated plugins",
      description:
        wordpress.plugins.outdated > 0
          ? `${wordpress.plugins.outdated} plugin(s) are outdated.`
          : "Plugin versions are current.",
      severity: wordpress.plugins.outdated > 4 ? "high" : "medium",
      failed: wordpress.plugins.outdated > 0,
      action: "Update plugins in batches and verify compatibility.",
      remediationActionId: "wordpress-update-plugins",
      automationLevel: "guided",
    },
    {
      id: "wp-object-cache",
      category: "performance",
      title: "Object cache",
      description: wordpress.performanceData.objectCache
        ? "Persistent object cache is enabled."
        : "No persistent object cache detected.",
      severity: "medium",
      failed: !wordpress.performanceData.objectCache,
      action: "Enable Redis or Memcached object cache.",
      remediationActionId: "wordpress-enable-object-cache",
      automationLevel: "guided",
    },
    {
      id: "wp-gzip",
      category: "performance",
      title: "Compression",
      description: wordpress.performanceData.gzipEnabled
        ? "HTTP compression is enabled."
        : "No gzip compression detected.",
      severity: "medium",
      failed: !wordpress.performanceData.gzipEnabled,
      action: "Enable gzip or Brotli compression at server/CDN layer.",
      remediationActionId: "wordpress-enable-compression",
      automationLevel: "guided",
    },
    {
      id: "seo-sitemap",
      category: "seo-ux",
      title: "Sitemap availability",
      description: "Sitemap visibility should be verified for indexing health.",
      severity: "medium",
      failed: false,
      warning: true,
      action: "Ensure /sitemap.xml is reachable and listed in robots.txt.",
      remediationActionId: "wordpress-fix-sitemap",
      automationLevel: "manual",
    },
    {
      id: "red-flag-hidden-plugins",
      category: "red-flags",
      title: "Hidden plugin behavior",
      description:
        wordpress.plugins.total === 0 && wordpress.plugins.active > 0
          ? "Mismatch in plugin totals may indicate hidden or inaccessible plugins."
          : "No immediate hidden-plugin indicator found.",
      severity: "high",
      failed: wordpress.plugins.total === 0 && wordpress.plugins.active > 0,
      action: "Cross-check DB plugin rows and admin plugin list for integrity.",
      remediationActionId: "wordpress-audit-plugins-integrity",
      automationLevel: "manual",
    },
    {
      id: "red-flag-core-modifications",
      category: "red-flags",
      title: "Unexpected core modification risk",
      description: wordpress.version.outdated
        ? "Outdated core increases probability of unauthorized core modifications."
        : "Core version state does not indicate immediate modification risk.",
      severity: "critical",
      failed: wordpress.version.outdated,
      action: "Run file integrity scan for wp-admin/wp-includes and compare checksums.",
      remediationActionId: "wordpress-run-integrity-scan",
      automationLevel: "guided",
    },
  ];

  return checks.map((check) => ({
    id: check.id,
    category: check.category,
    title: check.title,
    description: check.description,
    severity: check.severity,
    checkedByDefault: check.severity === "critical" || check.severity === "high",
    status: check.failed ? "fail" : check.warning ? "warning" : "pass",
    action: check.action,
    remediationActionId: check.remediationActionId,
    automationLevel: check.automationLevel,
  }));
}
