// components/site-cockpit/cards/SecurityCard.tsx
import { CockpitCard } from "../CockpitCard";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import type { SecurityData } from "@/types/site-cockpit";

interface SecurityCardProps {
  data: SecurityData;
}

export function SecurityCard({ data }: SecurityCardProps) {
  const certificate = (data as any).certificate;

  return (
    <CockpitCard
      id="security"
      category="security"
      title="Security"
      score={data.score}
    >
      <div className="space-y-4">
        {/* HTTPS */}
        {data.https !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              HTTPS Enabled
            </span>
            {data.https ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
        )}

        {/* Certificate */}
        {certificate && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              SSL Certificate
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Valid
                </span>
                {certificate.valid ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              {certificate.issuer && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Issuer
                  </span>
                  <span className="text-sm font-medium">
                    {certificate.issuer}
                  </span>
                </div>
              )}
              {certificate.expiresIn && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Expires
                  </span>
                  <span className="text-sm font-medium">
                    {certificate.expiresIn}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Headers */}
        {data.headers &&
          (Array.isArray(data.headers)
            ? data.headers.length > 0
            : Object.keys(data.headers).length > 0) && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Security Headers
              </h4>
              <div className="space-y-2">
                {Array.isArray(data.headers)
                  ? data.headers.map((header) => (
                      <div key={header} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {header}
                        </span>
                      </div>
                    ))
                  : Object.entries(data.headers).map(([key, header]) => {
                      const label = typeof header === "string" ? header : key;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {label}
                          </span>
                        </div>
                      );
                    })}
              </div>
            </div>
          )}

        {/* Vulnerabilities */}
        {data.vulnerabilities &&
          data.vulnerabilities.details &&
          data.vulnerabilities.details.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Vulnerabilities (
                {data.vulnerabilities.total ??
                  data.vulnerabilities.details.length}
                )
              </h4>
              <ul className="space-y-1">
                {data.vulnerabilities.details.slice(0, 3).map((vuln, idx) => {
                  const text =
                    typeof vuln === "string"
                      ? vuln
                      : (vuln as any)?.message ??
                        (vuln as any)?.title ??
                        JSON.stringify(vuln);
                  return (
                    <li
                      key={idx}
                      className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                    >
                      <span className="text-orange-500 mt-0.5">•</span>
                      <span>{text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
      </div>
    </CockpitCard>
  );
}
