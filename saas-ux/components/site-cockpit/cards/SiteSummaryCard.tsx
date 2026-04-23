// components/site-cockpit/cards/SiteSummaryCard.tsx
import { Bot } from "lucide-react";

interface SiteSummaryCardProps {
  summary: string;
}

export function SiteSummaryCard({ summary }: SiteSummaryCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl backdrop-blur-xl border transition-all duration-300"
      style={{
        background: "var(--header-bg)",
        borderColor: "oklch(from var(--category-seo) l c h / 0.25)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "oklch(from var(--category-seo) l c h / 0.45)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "oklch(from var(--category-seo) l c h / 0.25)";
      }}
    >
      {/* Subtle gradient wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, oklch(from var(--category-seo) l c h / 0.04) 0%, transparent 60%)",
        }}
      />

      <div className="relative flex items-start gap-4 px-6 py-5">
        <span
          className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "oklch(from var(--category-seo) l c h / 0.12)",
            color: "var(--category-seo)",
          }}
        >
          <Bot className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--category-seo)" }}
          >
            AI Site Summary
          </p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-primary)" }}
          >
            {summary}
          </p>
        </div>
      </div>
    </div>
  );
}
