// components/analyzer/display/ScorePills.tsx
import ScoreBar from "./ScoreBar";

type Props = {
  scores: {
    seo: number;
    a11y: number;
    perf: number;
    sec: number;
  };
  counts: {
    seo: { pass: number; warn: number; crit: number };
    a11y: { pass: number; warn: number; crit: number };
    perf: { pass: number; warn: number; crit: number };
    sec: { pass: number; warn: number; crit: number };
  };
};

export default function ScorePills({ scores, counts }: Props) {
  return (
    <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <ScoreBar
        category="seo"
        label="SEO"
        icon="🔍"
        score={scores.seo}
        {...counts.seo}
      />
      <ScoreBar
        category="a11y"
        label="Accessibility"
        icon="♿"
        score={scores.a11y}
        {...counts.a11y}
      />
      <ScoreBar
        category="perf"
        label="Performance"
        icon="⚡"
        score={scores.perf}
        {...counts.perf}
      />
      <ScoreBar
        category="sec"
        label="Security"
        icon="🔒"
        score={scores.sec}
        {...counts.sec}
      />
    </div>
  );
}
