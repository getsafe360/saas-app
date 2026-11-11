// components/site-cockpit/cards/wordpress/components/EmptyStates/ConnectPreview.tsx
"use client";

import { AlertTriangle, ArrowUp, Check, Download, FlaskConical, Search, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { connectPreview } from "@/lib/wordpress/connect-preview";
import { CURRENT_PLUGIN_VERSION, isPluginOutdated } from "@/lib/wordpress/plugin-version";

interface ConnectPreviewProps {
  domain: string;
  /** Failing public checks of this site (ids). */
  problemIds: ReadonlyArray<string>;
  pluginVersion?: string;
}

const INSIDE_CHECKS = ["updates", "core", "settings", "database"] as const;

function scrollToConnection() {
  document.getElementById("connection-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Before pairing: what connecting would fix on this site, taken from its own
 * public findings, plus what we can only check from inside WordPress.
 */
export function ConnectPreview({ domain, problemIds, pluginVersion }: ConnectPreviewProps) {
  const t = useTranslations("SiteCockpit.wordpress.preview");
  const tFindings = useTranslations("Findings");
  const { automatic, lasting, tested } = connectPreview(problemIds);
  const title = (id: string) => (tFindings.has(`${id}.title`) ? tFindings(`${id}.title`) : id);
  const outdated = !!pluginVersion && isPluginOutdated(pluginVersion);

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {t("title", { domain })}
      </p>

      {automatic.length === 0 && lasting.length === 0 && tested.length === 0 && (
        <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
          {t("nothingPublic")}
        </p>
      )}

      {automatic.length > 0 && (
        <section aria-labelledby="preview-automatic">
          <h5 id="preview-automatic" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            <Wand2 className="h-3.5 w-3.5 text-emerald-300" />
            {t("automaticTitle")}
          </h5>
          <ul className="space-y-1">
            {automatic.map((id) => (
              <li key={id} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-primary)" }}>
                <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-300" />
                {title(id)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {lasting.length > 0 && (
        <section aria-labelledby="preview-lasting">
          <h5 id="preview-lasting" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            <Wand2 className="h-3.5 w-3.5 text-amber-300" />
            {t("lastingTitle")}
          </h5>
          <ul className="space-y-1">
            {lasting.map((id) => (
              <li key={id} className="text-xs" style={{ color: "var(--text-primary)" }}>
                <span className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
                  {title(id)}
                </span>
                {id === "sec-hsts" && (
                  <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-subtle)", paddingLeft: "1.375rem" }}>
                    {t("hstsLasting")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tested.length > 0 && (
        <section aria-labelledby="preview-tested">
          <h5 id="preview-tested" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            <FlaskConical className="h-3.5 w-3.5 text-sky-300" />
            {t("testedTitle")}
          </h5>
          <ul className="space-y-1">
            {tested.map((id) => (
              <li key={id} className="text-xs" style={{ color: "var(--text-primary)" }}>
                <span className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-300" />
                  {title(id)}
                </span>
                {id === "sec-csp" && (
                  <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-subtle)", paddingLeft: "1.375rem" }}>
                    {t("cspTested")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="preview-inside">
        <h5 id="preview-inside" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          <Search className="h-3.5 w-3.5" style={{ color: "var(--category-wordpress)" }} />
          {t("insideTitle")}
        </h5>
        <ul className="space-y-1">
          {INSIDE_CHECKS.map((key) => (
            <li key={key} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-subtle)" }}>
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full" style={{ background: "var(--text-subtle)" }} />
              {t(`inside.${key}`)}
            </li>
          ))}
        </ul>
      </section>

      {outdated && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 p-3 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1">{t("pluginOutdated", { installed: pluginVersion!, latest: CURRENT_PLUGIN_VERSION })}</span>
          <a
            href="/wp-plugin/getsafe360-connector.zip"
            download
            className="inline-flex items-center gap-1 gs-btn gs-btn-upgrade rounded-md px-2 py-1 font-medium"
          >
            <Download className="h-3 w-3" />
            {t("download", { version: CURRENT_PLUGIN_VERSION })}
          </a>
        </div>
      )}

      <p className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
        {t("privacy")}
      </p>

      <button
        type="button"
        onClick={scrollToConnection}
        className="inline-flex items-center gap-1.5 rounded-lg gs-btn gs-btn-primary px-3 py-1.5 text-xs font-semibold text-white "
      >
        <ArrowUp className="h-3.5 w-3.5" />
        {t("cta")}
      </button>
    </div>
  );
}
