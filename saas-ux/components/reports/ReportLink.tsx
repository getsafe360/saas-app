// components/reports/ReportLink.tsx
"use client";

import { Crown, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { canGenerateReports, isPlanName } from "@/lib/plans/config";

interface ReportLinkProps {
  siteId: string;
  planName?: string;
}

export function reportsPagePath(siteId: string): string {
  return `/dashboard/sites/${siteId}/reports`;
}

/** Paid plans go to the site's Reports page; free plans to the plans page. */
export function ReportLink({ siteId, planName = "free" }: ReportLinkProps) {
  const t = useTranslations("Reports.card");
  const paid = isPlanName(planName) && canGenerateReports(planName);

  if (!paid) {
    return (
      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 gs-btn gs-btn-upgrade rounded-lg px-4 py-2 text-sm font-medium"
      >
        <Crown className="h-4 w-4" />
        {t("upgrade")}
      </Link>
    );
  }
  return (
    <Link
      href={reportsPagePath(siteId)}
      className="inline-flex items-center gap-2 rounded-lg gs-btn gs-btn-primary px-4 py-2 text-sm font-semibold text-white transition-colors "
    >
      <FileText className="h-4 w-4" />
      {t("open")}
    </Link>
  );
}
