// components/site-cockpit/cards/wordpress/utils/formatting.ts

/**
 * Formats a date to localized string
 */
export function formatDate(
  date: Date | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "Never";

  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  return date.toLocaleString("en-US", options || defaultOptions);
}

/**
 * Formats a date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | undefined): string {
  if (!date) return "Never";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? "s" : ""} ago`;
    }
  }

  return "Just now";
}

/**
 * Formats version numbers with comparison
 */
export function formatVersionComparison(
  current: string,
  latest: string
): {
  text: string;
  isOutdated: boolean;
  severity: "critical" | "high" | "medium" | "low";
} {
  const isOutdated = current !== latest;

  if (!isOutdated) {
    return {
      text: `v${current} (latest)`,
      isOutdated: false,
      severity: "low",
    };
  }

  // Simple version comparison for severity
  const currentParts = current.split(".").map(Number);
  const latestParts = latest.split(".").map(Number);

  let severity: "critical" | "high" | "medium" | "low" = "low";

  // Major version difference
  if (currentParts[0] < latestParts[0]) {
    severity = "critical";
  }
  // Minor version difference
  else if (currentParts[1] < latestParts[1]) {
    severity = "high";
  }
  // Patch version difference
  else if (currentParts[2] < latestParts[2]) {
    severity = "medium";
  }

  return {
    text: `v${current} → v${latest}`,
    isOutdated,
    severity,
  };
}

/**
 * Formats plugin/theme count text
 */
export function formatCount(count: number, singular: string, plural?: string): string {
  if (count === 0) return `No ${plural || singular + "s"}`;
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural || singular + "s"}`;
}

/**
 * Formats vulnerability severity
 */
export function formatSeverity(severity: string): {
  text: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  const severityMap: Record<string, { text: string; color: string; bgColor: string; borderColor: string }> = {
    critical: {
      text: "Critical",
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
    },
    high: {
      text: "High",
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
    },
    medium: {
      text: "Medium",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/20",
    },
    low: {
      text: "Low",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
    },
  };

  return severityMap[severity.toLowerCase()] || severityMap.low;
}

/**
 * Formats file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Formats percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Truncates text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Formats boolean as Yes/No or Enabled/Disabled
 */
export function formatBoolean(
  value: boolean,
  format: "yes-no" | "enabled-disabled" | "on-off" = "yes-no"
): string {
  const formatMap = {
    "yes-no": value ? "Yes" : "No",
    "enabled-disabled": value ? "Enabled" : "Disabled",
    "on-off": value ? "On" : "Off",
  };

  return formatMap[format];
}

/**
 * Formats days old
 */
export function formatDaysOld(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "1 day old";
  if (days < 7) return `${days} days old`;
  
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week old";
  if (weeks < 4) return `${weeks} weeks old`;
  
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month old";
  if (months < 12) return `${months} months old`;
  
  const years = Math.floor(days / 365);
  if (years === 1) return "1 year old";
  return `${years} years old`;
}

/**
 * Formats a list of items with proper grammar
 */
export function formatList(items: string[], maxItems: number = 3): string {
  if (items.length === 0) return "none";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;

  const displayItems = items.slice(0, maxItems);
  const remaining = items.length - maxItems;

  if (remaining > 0) {
    return `${displayItems.join(", ")}, and ${remaining} more`;
  }

  const lastItem = displayItems.pop();
  return `${displayItems.join(", ")}, and ${lastItem}`;
}

/**
 * Formats plugin/theme slug to display name
 */
export function formatSlugToName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Formats vulnerability description
 */
export function formatVulnerabilityDescription(
  description: string,
  maxLength: number = 100
): string {
  // Remove HTML tags
  const cleaned = description.replace(/<[^>]*>/g, "");
  
  // Truncate if needed
  return truncateText(cleaned, maxLength);
}

/**
 * Gets color for score/grade
 */
export function getScoreColor(score: number): {
  text: string;
  bg: string;
  border: string;
} {
  if (score >= 90) {
    return {
      text: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
    };
  }
  if (score >= 70) {
    return {
      text: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    };
  }
  if (score >= 50) {
    return {
      text: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
    };
  }
  if (score >= 30) {
    return {
      text: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
    };
  }
  return {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  };
}

/**
 * Formats grade letter with color
 */
export function getGradeColor(grade: string): {
  text: string;
  bg: string;
  border: string;
} {
  const gradeMap: Record<string, { text: string; bg: string; border: string }> = {
    A: {
      text: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
    },
    B: {
      text: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    C: {
      text: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
    },
    D: {
      text: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
    },
    F: {
      text: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    },
  };

  return gradeMap[grade.toUpperCase()] || gradeMap.C;
}