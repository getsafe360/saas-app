'use client';

import { useEffect, useState } from 'react';
import type { CockpitSavings } from '@/lib/cockpit/sse-events';

export function SavingsCard({ savings }: { savings: CockpitSavings | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (savings) setVisible(true);
  }, [savings]);

  if (!savings) return null;

  return (
    <div
      className={`rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
    >
      <h3 className="text-sm font-semibold text-emerald-200">Projected Savings</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-emerald-100">
        <div>Score: {savings.score_before} → {savings.score_after}</div>
        <div>Time saved: {savings.time_saved}</div>
        <div>Cost saved: {savings.cost_saved}</div>
        <div>Tokens used: {savings.tokens_used}</div>
      </div>
    </div>
  );
}
