// saas-ux/components/analyzer/findings/PillarColumn.tsx
"use client";

import { useMemo } from "react";
import { ScoreBar } from "@/components/ui/ScoreBar";
import FindingsFeed from "@/components/analyzer/findings/FindingsFeed";
import type { Finding } from "@/components/analyzer/utils/parseFindings";
import type { PillarColumnProps } from "./types";

type Score = { ok: number; warn: number; crit: number };

type Props = {
  label: string;
  items: Finding[];
  score?: Score; // optional; will be computed from items if omitted
};

function countTriplet(items: Finding[]): Score {
  let ok = 0, warn = 0, crit = 0;
  for (const it of items) {
    if (it.severity === "minor") ok++;
    else if (it.severity === "medium") warn++;
    else crit++;
  }
  return { ok, warn, crit };
}

export default function PillarColumn({ label, items, score, onFixItem, isCollapsed }: PillarColumnProps) {
  const computed = useMemo(() => score ?? countTriplet(items), [score, items]);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-semibold">{label}</div>
      <ScoreBar label={label} ok={computed.ok} warn={computed.warn} crit={computed.crit} />
      <FindingsFeed items={items} />
    </div>
  );
}

