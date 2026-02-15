// components/site-cockpit/cards/SecurityCard.tsx
import { CockpitCard } from "../cards/CockpitCard";
import { CheckCircle, XCircle } from "lucide-react";
import type { SecurityData } from "@/types/site-cockpit";

interface SecurityCardProps {
  data: SecurityData;
}

export function SecurityCard({ data }: SecurityCardProps) {
  const httpsEnabled = data.https?.enabled;
  const headerEntries = [
    ["CSP", data.headers?.contentSecurityPolicy?.present],
    ["HSTS", data.headers?.strictTransportSecurity?.present],
    ["X-Frame-Options", data.headers?.xFrameOptions?.present],
    ["X-Content-Type-Options", data.headers?.xContentTypeOptions?.present],
  ] as const;

  return (
    <CockpitCard
      id="security"
      category="security"
      title="Security"
      score={data.score}
      grade={data.grade}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-400">HTTPS Enabled</span>
          {httpsEnabled ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Security Headers</h4>
          <div className="space-y-2">
            {headerEntries.map(([label, present]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
                {present ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">Vulnerabilities</span>
            <span className="text-sm font-medium">{data.vulnerabilities?.total ?? 0}</span>
          </div>
        </div>
      </div>
    </CockpitCard>
  );
}
