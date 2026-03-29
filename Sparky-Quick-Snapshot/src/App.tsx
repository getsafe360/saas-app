import React, { useMemo, useState } from "react";
import {
  Search,
  Accessibility,
  Zap,
  Globe,
  ShieldCheck,
  FileText,
  Layout,
  ArrowRight,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AnalysisCard } from "./components/AnalysisCard";
import { SparkyTerminal } from "./components/SparkyTerminal";
import type { AnalysisResult, Category, InsightCardData, SupportedLocale } from "./types";
import { useSparkySnapshotStream } from "./hooks/useSparkySnapshotStream";
import { getLabels } from "./i18n";

const categories: Array<{ id: Category; title: string; icon: typeof Accessibility; colorClass: string }> = [
  {
    id: "accessibility",
    title: "Accessibility",
    icon: Accessibility,
    colorClass: "border-violet-500/30",
  },
  {
    id: "performance",
    title: "Performance",
    icon: Zap,
    colorClass: "border-amber-500/30",
  },
  {
    id: "seo",
    title: "SEO & GEO",
    icon: Globe,
    colorClass: "border-cyan-500/30",
  },
  {
    id: "security",
    title: "Security",
    icon: ShieldCheck,
    colorClass: "border-red-500/30",
  },
  {
    id: "content",
    title: "Content",
    icon: FileText,
    colorClass: "border-emerald-500/30",
  },
];

function getValidatedCtaHref(rawUrl: string): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export default function App() {
  const [url, setUrl] = useState("");
  const [locale, setLocale] = useState<SupportedLocale>("en");

  const labels = useMemo(() => getLabels(locale), [locale]);
  const { logs, result, isAnalyzing, error, start } = useSparkySnapshotStream(locale);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    start(url);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-emerald-500/30">
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-12 lg:py-20">
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5"
          >
            <Zap size={14} className="text-emerald-500" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
              {labels.appBadge}
            </span>
          </motion.div>

          <h1 className="mb-4 font-sans text-5xl font-black tracking-tighter lg:text-7xl">
            QUICK <span className="text-emerald-500">SNAPSHOT</span>
          </h1>

          <p className="mx-auto max-w-xl text-lg text-white/40">{labels.subtitle}</p>
        </div>

        <div className="mb-12">
          <form onSubmit={onSubmit} className="relative mx-auto max-w-2xl space-y-3">
            <div className="flex justify-end">
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value as SupportedLocale)}
                className="rounded-md border border-white/10 bg-[#151619] px-2 py-1 text-xs text-white/70"
              >
                <option value="en">EN</option>
                <option value="de">DE</option>
                <option value="es">ES</option>
                <option value="fr">FR</option>
                <option value="pt">PT</option>
                <option value="it">IT</option>
              </select>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#151619] p-2 transition-all focus-within:border-emerald-500/50 focus-within:shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <div className="flex items-center gap-3 px-4">
                <Search className="text-white/20" size={20} />
                <input
                  type="text"
                  placeholder={labels.urlPlaceholder}
                  className="h-12 w-full bg-transparent font-sans text-lg outline-none placeholder:text-white/10"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  disabled={isAnalyzing}
                />
                <button
                  type="submit"
                  disabled={isAnalyzing || !url.trim()}
                  className="flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-6 font-mono text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      {labels.analyzeButton} <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
          </form>
        </div>

        <div className="mb-12">
          <SparkyTerminal logs={logs} isAnalyzing={isAnalyzing} labels={labels.terminal} />
        </div>

        <AnimatePresence>
          {result && <ResultSection result={result} labels={labels} />}
        </AnimatePresence>

        <footer className="mt-20 border-t border-white/5 pt-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/20">
            Powered by GetSafe360 AI Optimization Engine
          </p>
        </footer>
      </main>
    </div>
  );
}

function ResultSection({
  result,
  labels,
}: {
  result: AnalysisResult;
  labels: ReturnType<typeof getLabels>;
}) {
  const ctaHref = getValidatedCtaHref(result.cta.deepLink);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category, index) => (
          <AnalysisCard
            key={category.id}
            title={category.title}
            icon={category.icon}
            content={result[category.id] as InsightCardData}
            delay={0.08 * (index + 1)}
            className={category.colorClass}
            fallbackText={labels.fallbackText}
            metricLabel={labels.cardLabels.metric}
            evidenceLabel={labels.cardLabels.evidence}
            actionLabel={labels.cardLabels.action}
          />
        ))}

        {result.wordpress?.detected ? (
          <AnalysisCard
            title="WordPress Insights"
            icon={Layout}
            content={{
              status: "warning",
              summary: result.wordpress.insightsSummary ?? "WordPress detected.",
              metric: result.wordpress.version ? `Version ${result.wordpress.version}` : "Version unknown",
              evidence: result.wordpress.theme ? `Theme: ${result.wordpress.theme}` : "No theme details provided",
              actionHint: result.wordpress.automationHints?.[0] ?? "Review plugin and theme updates.",
            }}
            className="border-blue-500/40 bg-blue-500/5"
            delay={0.6}
            fallbackText={labels.fallbackText}
            metricLabel={labels.cardLabels.metric}
            evidenceLabel={labels.cardLabels.evidence}
            actionLabel={labels.cardLabels.action}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center rounded-xl border border-dashed border-white/5 bg-white/[0.02] p-5"
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/20">
              {labels.noCmsDetected}
            </p>
          </motion.div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#151619] p-8 lg:p-12">
        <div className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <h2 className="mb-4 font-sans text-3xl font-bold tracking-tight">{labels.executiveSummary}</h2>
            <p className="text-lg leading-relaxed text-white/60">{result.summary}</p>
          </div>
          <div className="flex shrink-0 gap-3">
            <button className="flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:bg-white/10">
              <Download size={16} /> {labels.exportPdf}
            </button>
            <button className="flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-mono text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-white/90">
              <ExternalLink size={16} /> {labels.fullReport}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex items-start gap-4">
            <div className="mt-1 rounded-full bg-emerald-500/20 p-2 text-emerald-500">
              <Zap size={20} />
            </div>
            <div>
              <h4 className="mb-1 font-mono text-xs font-bold uppercase tracking-widest text-emerald-500">
                {labels.recommendedAction}
              </h4>
              <p className="text-lg font-medium text-white/90">{result.cta.headline}</p>
              <p className="mt-1 text-sm text-white/70">{result.cta.body}</p>
              {ctaHref ? (
                <a
                  href={ctaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-500 hover:underline"
                >
                  {result.cta.buttonText} <ArrowRight size={14} />
                </a>
              ) : (
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white/40">
                  {result.cta.buttonText}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
