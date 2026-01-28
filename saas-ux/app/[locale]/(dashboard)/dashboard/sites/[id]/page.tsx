// app/[locale]/(dashboard)/dashboard/sites/[id]/page.tsx
// Phase 1: Redirect to cockpit - the site detail page is now the cockpit
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SiteDetail({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, locale } = await params;
  const sp = (searchParams ? await searchParams : {}) ?? {};

  // Build query string to preserve searchParams (e.g., ?connected=1)
  const queryString = Object.entries(sp)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const value = Array.isArray(v) ? v[0] : v;
      return `${encodeURIComponent(k)}=${encodeURIComponent(value || "")}`;
    })
    .join("&");

  const basePath = locale === "en"
    ? `/dashboard/sites/${id}/cockpit`
    : `/${locale}/dashboard/sites/${id}/cockpit`;

  const targetUrl = queryString ? `${basePath}?${queryString}` : basePath;

  redirect(targetUrl);
}
