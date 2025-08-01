'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

// --- MOCK DATA for design (replace with real data later) ---
const mockResult = {
  score: 49,
  checks: 30,
  passed: 24,
  issues: [
    {
      severity: "critical",
      summary: 'Elements with `role="dialog"` do not have accessible names.',
      elements: 1,
      details: "Dialog elements require accessible names so screen readers can identify them."
    },
    {
      severity: "critical",
      summary: "Background and foreground colors do not have sufficient contrast ratio.",
      elements: 2,
      details: "Improve color contrast to meet minimum WCAG AA requirements."
    },
    {
      severity: "critical",
      summary: "Heading elements are not in a sequentially-descending order.",
      elements: 2,
      details: "Headings must follow a logical outline for screen readers."
    }
  ],
  passed_checks: [
    "Page has a language attribute.",
    "Images have alt text.",
    "Form fields have labels.",
    "Links have descriptive text.",
    "No duplicate IDs detected."
  ]
};

const mockAuditTokens = {
  input: 12300,
  output: 4800
};

// --- Token pricing logic ---
function calculateAuditCost(input = 0, output = 0, level = "all") {
  const INPUT_TOKEN_PRICE = 0.0000010;
  const OUTPUT_TOKEN_PRICE = 0.0000030;
  const CURRENCY_SYMBOL = "€";
  let factor = level === "critical" ? 0.7 : 1.0; // Cheaper for "critical only"
  const input_cost = input * INPUT_TOKEN_PRICE * factor;
  const output_cost = output * OUTPUT_TOKEN_PRICE * factor;
  const total_cost = input_cost + output_cost;
  return {
    InputCost: `${CURRENCY_SYMBOL}${input_cost.toFixed(4)}`,
    OutputCost: `${CURRENCY_SYMBOL}${output_cost.toFixed(4)}`,
    TotalCost: `${CURRENCY_SYMBOL}${total_cost.toFixed(2)}`
  };
}

export default function AccessibilityResultPage() {
  const t = useTranslations('ux');
  const [processing, setProcessing] = useState<"critical" | "all" | null>(null);

  // Use the mock data here directly
  const result = mockResult;
  const auditTokens = mockAuditTokens;

  // Use the correct mock values
  const inputTokens = auditTokens.input;
  const outputTokens = auditTokens.output;
  const costCritical = calculateAuditCost(inputTokens, outputTokens, "critical");
  const costAll = calculateAuditCost(inputTokens, outputTokens, "all");

  const criticalIssues = result?.issues?.filter(i => i.severity === "critical") ?? [];
  const passedChecks = result?.passed_checks ?? [];

  // Pie chart numbers
  const issuesCount = result?.issues?.length ?? 0;
  const passedCount = result?.passed ?? 0;
  const checks = result?.checks ?? 0;
  const piePercent = Math.round((issuesCount / checks) * 100);

  return (
    <main className="min-h-[90vh] flex flex-col items-center justify-center bg-[#101217] dark:bg-[#101217] py-10 px-2">
      <section className="rounded-3xl bg-[#191b21] shadow-2xl p-8 w-full max-w-3xl border border-[#23282f]">
        {/* Header & Score */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-6">
          <div>
            <div className="text-4xl sm:text-5xl font-extrabold mb-1 text-blue-200 leading-tight drop-shadow-lg">
              {t('score_label')}:
            </div>
            <div className="text-lg text-gray-300">
              {t('criteria_checked')}: <b>{checks}</b>
            </div>
            <div className="text-lg text-gray-300">
              {t('issues_found')}: <b>{issuesCount}</b>
            </div>
          </div>
          {/* Pie chart for Accessibility Score */}
          <div className="flex flex-col items-center">
            <svg width={96} height={96} viewBox="0 0 36 36" className="mb-2">
              <circle
                cx="18" cy="18" r="16"
                fill="none"
                stroke="#21232a"
                strokeWidth="4"
              />
              <circle
                cx="18" cy="18" r="16"
                fill="none"
                stroke="#60a5fa"
                strokeWidth="4"
                strokeDasharray={`${result?.score ?? 0}, 100`}
                strokeDashoffset="25"
                style={{ transition: "stroke-dasharray 1s" }}
              />
              <text x="18" y="22" textAnchor="middle" fontSize="1em" fill="#fbbf24" fontWeight={700}>
                {result?.score ?? "--"}%
              </text>
            </svg>
            <div className="text-gray-300 text-xs text-center" style={{ lineHeight: 1.1 }}>
              {t('score_label_short')}
            </div>
          </div>
        </div>

        {/* Passed Checks */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-green-400 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {t('passed_label', { count: passedChecks.length })}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {passedChecks.map((check, i) => (
              <li key={i} className="flex items-center gap-1 border border-green-400 text-green-200 px-3 py-1 rounded-full text-xs font-semibold bg-[#142918]">
                <CheckCircle className="w-4 h-4" /> <span>{check}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Critical Issues */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            {t('critical_issues', { count: criticalIssues.length })}
          </h2>
          {criticalIssues.length === 0 ? (
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              {t('no_critical_issues')}
            </div>
          ) : (
            <ol className="space-y-4 pl-4 list-decimal">
              {criticalIssues.map((issue, i) => (
                <li key={i} className="bg-red-900/50 border-l-4 border-red-500 p-3 rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="text-red-400 w-5 h-5" />
                    <span className="font-semibold text-red-100">{issue.summary}</span>
                    <span className="ml-2 text-xs text-red-300">
                      ({issue.elements} {t('elements')})
                    </span>
                  </div>
                  <div className="text-xs text-red-200">{issue.details}</div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col md:flex-row gap-4 mt-8">
          <button
            className={`bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl w-full md:w-auto shadow-lg transition ${
              processing === "critical" ? "opacity-60 cursor-wait" : ""
            }`}
            disabled={processing === "critical"}
            onClick={() => {
              setProcessing("critical");
              setTimeout(() => setProcessing(null), 2000); // demo only
            }}
          >
            {processing === "critical" ? (
              <span className="animate-pulse">{t('processing')}</span>
            ) : (
              <>
                {t('fix_critical_btn')} <span className="ml-2">{costCritical.TotalCost}</span>
              </>
            )}
          </button>
          <button
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl w-full md:w-auto shadow-lg transition ${
              processing === "all" ? "opacity-60 cursor-wait" : ""
            }`}
            disabled={processing === "all"}
            onClick={() => {
              setProcessing("all");
              setTimeout(() => setProcessing(null), 2000); // demo only
            }}
          >
            {processing === "all" ? (
              <span className="animate-pulse">{t('processing')}</span>
            ) : (
              <>
                {t('supreme_repair_btn')} <span className="ml-2">{costAll.TotalCost}</span>
              </>
            )}
          </button>
        </div>
      </section>
    </main>
  );
}
// Note: This code is a mockup and does not include real data fetching or processing logic.