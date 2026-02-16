// components/site-cockpit/cards/wordpress/utils/healthEngine.ts

import type {
  ImpactLevel,
  WordPress,
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
  action: string;
};

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
    },
  ];

  return checks.map((check) => ({
    id: check.id,
    category: check.category,
    title: check.title,
    description: check.description,
    severity: check.severity,
    checkedByDefault: check.severity === "critical" || check.severity === "high",
    status: check.failed ? "fail" : "pass",
    action: check.action,
  }));
}

