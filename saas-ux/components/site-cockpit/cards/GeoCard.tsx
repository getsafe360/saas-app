import { CockpitCard } from "./CockpitCard";

interface GeoCardProps {
  score?: number;
}

export function GeoCard({ score = 62 }: GeoCardProps) {
  return (
    <CockpitCard
      id="geo"
      category="geo"
      title="GEO"
      score={score}
      grade="B-"
      className="lg:col-span-2"
      stats={{ passed: 1, warnings: 2, criticalIssues: 1 }}
    >
      <div className="space-y-4">
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "oklch(from var(--category-geo) l c h / 0.35)",
            background:
              "linear-gradient(135deg, oklch(from var(--category-geo) l c h / 0.18), oklch(from var(--category-seo) l c h / 0.12), oklch(from var(--category-accessibility) l c h / 0.14))",
          }}
        >
          <p className="text-sm text-white/90 leading-relaxed">
            Generative Engine Optimization (GEO) is becoming a must-have as AI
            assistants and AI overviews increasingly replace classic result-page
            clicks. This placeholder card will soon score your visibility in
            AI-generated answers and brand mention confidence.
          </p>
        </div>

        <div className="text-sm" style={{ color: "var(--text-subtle)" }}>
          Planned metrics: AI citation presence, answer inclusion, entity
          coverage, and prompt-intent match quality.
        </div>
      </div>
    </CockpitCard>
  );
}
