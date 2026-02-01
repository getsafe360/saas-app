// app/[locale]/(dashboard)/dashboard/layout.tsx  (CLIENT component)
"use client";

import { useState, useEffect } from "react";
import { Link, useRouter } from "@/navigation";
import { usePathname, useParams } from "next/navigation";
import { Settings, Activity, Menu, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { UserGreeting } from "@/components/ui/user-greeting";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import CTA from "@/components/marketing/CTA";
import { SiteSelectorDropdown } from "@/components/dashboard/SiteSelectorDropdown";

// Site data type
interface SiteData {
  id: string;
  siteUrl: string;
  canonicalHost: string;
  lastScores?: {
    performance?: number;
    security?: number;
    seo?: number;
    accessibility?: number;
    overall?: number;
  };
  lastFaviconUrl?: string;
  lastScreenshotUrl?: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sites, setSites] = useState<SiteData[]>([]);
  const [isLoadingSites, setIsLoadingSites] = useState(true);
  const t = useTranslations("DashboardNav");
  const ts = useTranslations("Nav");

  // Extract current site ID from URL if on a site-specific page
  const currentSiteId = typeof params?.id === 'string' ? params.id : undefined;

  // Fetch user's sites - refetch when pathname changes (e.g., after adding/removing)
  useEffect(() => {
    async function fetchSites() {
      try {
        const response = await fetch('/api/sites');
        if (response.ok) {
          const data = await response.json();
          setSites(data.sites || []);
        }
      } catch (error) {
        console.error('Failed to fetch sites:', error);
      } finally {
        setIsLoadingSites(false);
      }
    }
    fetchSites();
  }, [pathname]);

  // Handle site change from dropdown
  const handleSiteChange = (siteId: string) => {
    router.push(`/dashboard/sites/${siteId}/cockpit`);
  };

  // Static nav items (always visible)
  const staticNavItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "overview" },
    { href: "/dashboard/activity", icon: Activity, label: "activity" },
    { href: "/dashboard/settings", icon: Settings, label: "settings" },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] max-w-7xl mx-auto w-full">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4">
        <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
          Dashboard
        </span>
        <Button
          variant="ghost"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <aside
          className={`w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900
            lg:block ${isSidebarOpen ? "block" : "hidden"}
            lg:relative absolute inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out
            lg:translate-x-0 ${
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }
          `}
        >
          {/* User info / branding */}
          <div className="flex items-center gap-3 mb-4 px-3 pt-3">
            <UserGreeting />
          </div>

          {/* Site Selector Dropdown with Category Links */}
          <div className="px-3 mb-4">
            {isLoadingSites ? (
              <div className="h-12 rounded-xl bg-gray-800/30 animate-pulse" />
            ) : (
              <SiteSelectorDropdown
                sites={sites}
                currentSiteId={currentSiteId}
                onSiteChange={handleSiteChange}
              />
            )}
          </div>

          {/* Divider */}
          <div className="mx-3 mb-4 border-t border-gray-200 dark:border-gray-700" />

          {/* Static Navigation Items */}
          <nav className="px-2 overflow-y-auto">
            <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              {t("navigation") || "Navigation"}
            </div>
            {staticNavItems.map((item) => {
              // Check if this is the active route
              const isActive = pathname === item.href ||
                (item.href === "/dashboard" && pathname.endsWith("/dashboard"));

              return (
                <Link key={item.href} href={item.href} passHref>
                  <Button
                    variant="ghost"
                    className={`
                      shadow-none my-1 w-full justify-start gap-3 rounded-xl transition
                      border
                      ${
                        isActive
                          ? "border-blue-500 dark:border-blue-400 font-bold text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/30"
                          : "border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }
                    `}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{t(item.label)}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <SignedIn>
          <main className="flex-1 overflow-y-auto p-0 lg:p-6 bg-gray-50 dark:bg-[#10131a] min-h-screen transition-colors">
            {children}
          </main>
        </SignedIn>
        <SignedOut>
          <section className="mb-8 min-w-80">
            <CTA />
            <p className="text-center text-base text-gray-500 dark:text-gray-400">
              {ts("haveAccount")}?{" "}
              {/* Optional: subtle sign-in for returning users */}
              <SignInButton mode="modal">
                <button className="text-sky-600 hover:text-sky-700 underline-offset-2 hover:underline hover:cursor-pointer transition">
                  {ts("signIn")}
                </button>
              </SignInButton>
            </p>
          </section>
        </SignedOut>
      </div>
    </div>
  );
}
