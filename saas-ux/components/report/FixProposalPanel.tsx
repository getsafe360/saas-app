// components/report/FixProposalPanel.tsx
'use client';

import { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';

export type ProposedOperation = {
  kind: 'head_snippet' | 'connector_setting';
  issueId: string;
  title: string;
  effect: string;
  snippet?: string;
  key?: string;
  enabled?: boolean;
};

export type RejectedItem = { issueId: string; reason: string };

/**
 * The approval gate.
 *
 * Nothing reaches the customer's WordPress site until they press Apply here,
 * and no tokens are spent until the apply succeeds. The exact snippet is shown
 * rather than summarised, because "trust us, we'll inject something into your
 * <head>" is not a reasonable thing to ask someone to approve.
 */
export function FixProposalPanel({
  operations,
  rejected,
  estTokens,
  state,
  error,
  onApply,
  onCancel,
}: {
  operations: ProposedOperation[];
  rejected: RejectedItem[];
  estTokens: number;
  state: 'review' | 'applying' | 'applied' | 'failed';
  error?: string | null;
  onApply: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="rounded-2xl border border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
            Review before we change your site
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
            {operations.length} change{operations.length === 1 ? '' : 's'} ready.
            Nothing has been applied and no tokens have been used yet.
          </p>
        </div>
        <span className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium bg-white/70 dark:bg-slate-900/40">
          ~{estTokens.toLocaleString()} tokens
        </span>
      </div>

      <ul className="space-y-2">
        {operations.map((op) => {
          const isOpen = open[op.issueId] ?? false;
          return (
            <li
              key={op.issueId}
              className="rounded-xl border bg-white/70 dark:bg-slate-900/40 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpen((s) => ({ ...s, [op.issueId]: !isOpen }))}
                className="w-full flex items-center gap-2 p-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                aria-expanded={isOpen}
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0 opacity-60" />
                )}
                <span className="flex-1">
                  <span className="block text-sm font-medium">{op.title}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {op.effect}
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3">
                  {op.kind === 'head_snippet' ? (
                    <>
                      <div className="text-xs text-slate-500 mb-1">
                        Added to your site&apos;s &lt;head&gt;:
                      </div>
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all rounded-lg bg-slate-900 text-slate-100 p-3 overflow-x-auto">
                        {op.snippet}
                      </pre>
                    </>
                  ) : (
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      Sets the connector option <code className="font-mono">{op.key}</code> to{' '}
                      <code className="font-mono">{String(op.enabled)}</code>. You can reverse this
                      from the GetSafe 360 panel in your WordPress admin at any time.
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {rejected.length > 0 && (
        <div className="rounded-xl border border-slate-300/60 bg-white/50 dark:bg-slate-900/30 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <AlertTriangle className="w-4 h-4" />
            Not included
          </div>
          <ul className="mt-1 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            {rejected.map((r) => (
              <li key={r.issueId}>
                <span className="font-mono">{r.issueId}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state === 'failed' && error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}

      {state === 'applied' ? (
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <Check className="w-4 h-4" /> Applied to your site.
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onApply}
            disabled={state === 'applying'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900"
          >
            {state === 'applying' && <Loader2 className="w-4 h-4 animate-spin" />}
            {state === 'applying' ? 'Applying…' : `Apply and use ${estTokens.toLocaleString()} tokens`}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={state === 'applying'}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-white/60 disabled:opacity-60"
          >
            <X className="w-4 h-4" /> Discard
          </button>
        </div>
      )}
    </div>
  );
}
