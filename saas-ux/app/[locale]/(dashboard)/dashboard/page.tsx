// app/[locale]/(dashboard)/dashboard/page.tsx  (SERVER)
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import DashboardClient from "./DashboardClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "DashboardMeta" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function Page() {
  return <DashboardClient />;
}
