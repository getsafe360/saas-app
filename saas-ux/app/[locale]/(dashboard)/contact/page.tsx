import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ContactPageClient from "./ContactPageClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Support");

  return {
    title: t("contactPage.meta.title"),
    description: t("contactPage.meta.description"),
  };
}

export default function ContactPage() {
  return <ContactPageClient />;
}
