import React, { useState, useEffect } from "react";
import { GoogleGenAI, Type } from "@google/genai";
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
import { AnalysisResult } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default function App() {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  const analyzeWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    let formattedUrl = url;
    if (!url.startsWith("http")) {
      formattedUrl = `https://${url}`;
    }

    setIsAnalyzing(true);
    setResult(null);
    setError(null);
    setLogs([]);
    addLog(`Initiating scan for: ${formattedUrl}`);

    try {
      // Step 1: Fetch HTML via backend
      addLog("Fetching remote source code...");
      const fetchResponse = await fetch(
        `/api/fetch-html?url=${encodeURIComponent(formattedUrl)}`,
      );
      if (!fetchResponse.ok) throw new Error("Failed to reach target server.");
      const { html } = await fetchResponse.json();
      addLog(
        "✓ Source code acquired. Size: " +
          (html.length / 1024).toFixed(2) +
          "KB",
      );

      // Step 2: Analyze with Gemini
      addLog("Injecting payload into Sparky Engine...");

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            text: `Analyze the following HTML content of a website (${formattedUrl}) and provide a comprehensive developer-focused audit. 
            Categorize findings into: Accessibility, Performance, SEO, Security, and Content.
            Also, detect if it's a WordPress site (look for wp-content, wp-includes, generator meta tags).
            Provide a summary and a clear call-to-action for the developer.
            
            HTML Content:
            ${html.substring(0, 100000)}`,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              accessibility: {
                type: Type.STRING,
                description: "Accessibility audit findings",
              },
              performance: {
                type: Type.STRING,
                description: "Performance audit findings",
              },
              seo: {
                type: Type.STRING,
                description: "SEO & GEO audit findings",
              },
              security: {
                type: Type.STRING,
                description: "Security audit findings",
              },
              content: {
                type: Type.STRING,
                description: "Content quality audit findings",
              },
              wordpress: {
                type: Type.OBJECT,
                properties: {
                  detected: { type: Type.BOOLEAN },
                  version: { type: Type.STRING },
                  insights: {
                    type: Type.STRING,
                    description:
                      "WP specific insights like plugins, themes, or optimizations",
                  },
                },
                required: ["detected"],
              },
              summary: {
                type: Type.STRING,
                description: "Overall summary of the analysis",
              },
              cta: {
                type: Type.STRING,
                description: "Call to action for the developer",
              },
            },
            required: [
              "accessibility",
              "performance",
              "seo",
              "security",
              "content",
              "summary",
              "cta",
            ],
          },
        },
      });

      addLog("✓ Analysis complete. Parsing results...");
      const data = JSON.parse(response.text || "{}") as AnalysisResult;
      setResult(data);
      addLog("✓ Data grid populated.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
      addLog("! ERROR: Sequence terminated prematurely.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-emerald-500/30">
      {/* Background Grid */}
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-12 lg:py-20">
        {/* Header Section */}
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5"
          >
            <Zap size={14} className="text-emerald-500" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
              Sparky AI Engine
            </span>
          </motion.div>

          <h1 className="mb-4 font-sans text-5xl font-black tracking-tighter lg:text-7xl">
            QUICK <span className="text-emerald-500">SNAPSHOT</span>
          </h1>

          <p className="mx-auto max-w-xl text-lg text-white/40">
            Next-generation website analysis for developers. Instant audits,
            actionable insights, and WordPress automation.
          </p>
        </div>

        {/* Input Section */}
        <div className="mb-12">
          <form
            onSubmit={analyzeWebsite}
            className="relative mx-auto max-w-2xl"
          >
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#151619] p-2 transition-all focus-within:border-emerald-500/50 focus-within:shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <div className="flex items-center gap-3 px-4">
                <Search className="text-white/20" size={20} />
                <input
                  type="text"
                  placeholder="Enter website URL (e.g. example.com)"
                  className="h-12 w-full bg-transparent font-sans text-lg outline-none placeholder:text-white/10"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isAnalyzing}
                />
                <button
                  type="submit"
                  disabled={isAnalyzing || !url}
                  className="flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-6 font-mono text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>
                      Analyze <ArrowRight size={14} />
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

        {/* Terminal Section */}
        <div className="mb-12">
          <SparkyTerminal logs={logs} isAnalyzing={isAnalyzing} />
        </div>

        {/* Results Grid */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              {/* Category Cards Loop */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    id: "accessibility",
                    title: "Accessibility",
                    icon: Accessibility,
                  },
                  { id: "performance", title: "Performance", icon: Zap },
                  { id: "seo", title: "SEO & GEO", icon: Globe },
                  { id: "security", title: "Security", icon: ShieldCheck },
                  { id: "content", title: "Content", icon: FileText },
                ].map((cat, index) => (
                  <AnalysisCard
                    key={cat.id}
                    title={cat.title}
                    icon={cat.icon}
                    content={result[cat.id as keyof AnalysisResult] as string}
                    delay={0.1 * (index + 1)}
                  />
                ))}

                {/* Conditional WordPress Card */}
                {result.wordpress?.detected ? (
                  <AnalysisCard
                    title="WordPress Insights"
                    icon={Layout}
                    content={
                      result.wordpress.insights ||
                      `WordPress detected (v${result.wordpress.version || "unknown"}).`
                    }
                    className="border-emerald-500/30 bg-emerald-500/5"
                    delay={0.6}
                  />
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 }}
                    className="flex items-center justify-center rounded-xl border border-dashed border-white/5 bg-white/[0.02] p-5"
                  >
                    <p className="font-mono text-[10px] uppercase tracking-widest text-white/20">
                      No CMS Detected
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Summary & CTA */}
              <div className="rounded-2xl border border-white/10 bg-[#151619] p-8 lg:p-12">
                <div className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
                  <div className="max-w-2xl">
                    <h2 className="mb-4 font-sans text-3xl font-bold tracking-tight">
                      Executive Summary
                    </h2>
                    <p className="text-lg leading-relaxed text-white/60">
                      {result.summary}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button className="flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:bg-white/10">
                      <Download size={16} /> Export PDF
                    </button>
                    <button className="flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-mono text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-white/90">
                      <ExternalLink size={16} /> Full Report
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
                        Recommended Action
                      </h4>
                      <p className="text-lg font-medium text-white/90">
                        {result.cta}
                      </p>
                      <a
                        href="https://www.getsafe360.ai/pricing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-500 hover:underline"
                      >
                        Unlock 1-Click Fixes with Agent Plan{" "}
                        <ArrowRight size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-20 border-t border-white/5 pt-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/20">
            Powered by GetSafe360 AI Optimization Engine
          </p>
        </footer>
      </main>
    </div>
  );
}
