// saas-ux/components/analyzer/PillarColumn.tsx
"use client";
import { ScoreBar } from "@/components/ui/ScoreBar";
import FindingsFeed from "./FindingsFeed";
import { type Finding } from "./parseFindings";

type Props = {
  label: string;
  score: { ok: number; warn: number; crit: number };
  items: Finding[];
};

export default function PillarColumn({ label, score, items }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-semibold">{label}</div>
      <ScoreBar label={label} ok={score.ok} warn={score.warn} crit={score.crit} />
      <FindingsFeed items={items} />
    </div>
  );
}
