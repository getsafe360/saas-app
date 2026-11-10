// components/site-cockpit/WordPressTeaser.tsx
"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { WordPressAIIcon } from "@/components/icons/WordPressAI";
import { connectPreview } from "@/lib/wordpress/connect-preview";
import { wordpressPagePath } from "@/lib/wordpress/connection-status";
import type { ConnectionStatus } from "./cards/wordpress/types";

interface WordPressTeaserProps {
  siteId: string;
  connectionStatus: ConnectionStatus;
  problemIds: ReadonlyArray<string>;
}

/**
 * In the cockpit of a WordPress site that is not connected: one short card that
 * leads to the WordPress page, where connecting and fixing happen.
 */
export function WordPressTeaser({ siteId, connectionStatus, problemIds }: WordPressTeaserProps) {
  const t = useTranslations("SiteCockpit.wordpress.teaser");
  const { automatic, tested } = connectPreview(problemIds);
  const fixable = automatic.length + tested.length;
  const broken = connectionStatus === "error" || connectionStatus === "reconnecting";

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center"
      style={{ background: "var(--header-bg)", borderColor: "oklch(from var(--category-wordpress) l c h / 0.5)" }}
    >
      <span
        className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: "oklch(from var(--category-wordpress) l c h / 0.15)" }}
      >
        <WordPressAIIcon size={22} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--category-wordpress)" }}>
          {t("eyebrow")}
        </div>
        <p className="mt-1 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          {broken ? t("brokenTitle") : fixable > 0 ? t("fixableTitle", { count: fixable }) : t("title")}
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-subtle)" }}>
          {broken ? t("brokenDetail") : t("detail")}
        </p>
      </div>
      <Link
        href={wordpressPagePath(siteId, true)}
        className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:self-center"
      >
        {broken ? t("brokenCta") : t("cta")}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
