// components/analyzer/display/CoPilotDrawer.tsx
"use client";

import { useState } from "react";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

export default function CoPilotDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Drawer Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-gradient-to-l from-sky-500 to-purple-500 text-white px-3 py-6 rounded-l-lg shadow-lg hover:shadow-xl transition-all hover:pr-4 group"
        aria-label="Open Co-Pilot"
      >
        <div className="flex flex-col items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-semibold writing-mode-vertical-rl transform rotate-180">
            Co-Pilot
          </span>
        </div>
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-96 bg-neutral-900 border-l border-neutral-700 shadow-2xl z-50 transform transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-700">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-sky-400" />
            <h2 className="text-xl font-bold text-white">Co-Pilot</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Preview Message */}
          <div className="rounded-xl bg-gradient-to-br from-sky-500/10 to-purple-500/10 border border-sky-500/20 p-6">
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              👋 Hi there! I'm your AI-powered Co-Pilot. I can help you:
            </p>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">✓</span>
                <span>
                  Fix critical SEO & accessibility issues automatically
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Generate optimized content and meta tags</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Monitor your site 24/7 and alert you to problems</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Provide actionable recommendations in real-time</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="rounded-xl bg-gradient-to-r from-sky-500 to-purple-500 p-6 text-center">
            <h3 className="text-lg font-bold text-white mb-2">
              Unlock Full Co-Pilot Access
            </h3>
            <p className="text-sm text-white/80 mb-4">
              Sign up now to activate your AI assistant and start optimizing!
            </p>
            <button className="w-full bg-white text-neutral-900 font-semibold py-3 px-4 rounded-lg hover:bg-neutral-100 transition-colors inline-flex items-center justify-center gap-2">
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Feature Preview */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
              Coming Soon in Your Dashboard
            </h4>
            {[
              "One-click fixes for all issues",
              "AI-generated content suggestions",
              "Competitor analysis & benchmarking",
              "Custom optimization roadmaps",
            ].map((feature, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50 border border-neutral-700"
              >
                <div className="h-2 w-2 rounded-full bg-sky-400" />
                <span className="text-sm text-neutral-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
