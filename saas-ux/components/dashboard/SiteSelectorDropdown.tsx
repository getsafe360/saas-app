// components/dashboard/SiteSelectorDropdown.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Link } from "@/navigation";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Globe,
  ChevronDown,
  Plus,
  Zap,
  Shield,
  Search,
  Accessibility,
  Check,
} from "lucide-react";

interface SiteData {
  id: string;
  siteUrl: string;
  canonicalHost: string;
  status?: "pending" | "connected" | "disconnected" | string;
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

interface SiteSelectorDropdownProps {
  sites: SiteData[];
  currentSiteId?: string;
  onSiteChange?: (siteId: string) => void;
}

const CATEGORY_LINKS = [
  {
    id: "performance",
    labelKey: "performance",
    icon: Zap,
    color: "text-blue-300",
    iconBg: "bg-blue-500/15",
    href: (siteId: string) => `/dashboard/sites/${siteId}/cockpit?category=performance`,
  },
  {
    id: "security",
    labelKey: "security",
    icon: Shield,
    color: "text-green-300",
    iconBg: "bg-green-500/15",
    href: (siteId: string) => `/dashboard/sites/${siteId}/cockpit?category=security`,
  },
  {
    id: "seo",
    labelKey: "seo",
    icon: Search,
    color: "text-purple-300",
    iconBg: "bg-purple-500/15",
    href: (siteId: string) => `/dashboard/sites/${siteId}/cockpit?category=seo`,
  },
  {
    id: "accessibility",
    labelKey: "accessibility",
    icon: Accessibility,
    color: "text-orange-300",
    iconBg: "bg-orange-500/15",
    href: (siteId: string) => `/dashboard/sites/${siteId}/cockpit?category=accessibility`,
  },
] as const;

function formatHost(host: string) {
  if (!host) return host;
  return host.startsWith("www.") ? host.slice(4) : host;
}

export function SiteSelectorDropdown({
  sites,
  currentSiteId,
  onSiteChange,
}: SiteSelectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const tNav = useTranslations("DashboardNav");

  const currentSite = sites.find((s) => s.id === currentSiteId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const isConnected = currentSite?.status === "connected";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
          isOpen
            ? "border-blue-500 bg-blue-500/10"
            : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center overflow-hidden">
          {currentSite?.lastFaviconUrl ? (
            <img
              src={currentSite.lastFaviconUrl}
              alt={formatHost(currentSite.canonicalHost)}
              className="w-5 h-5"
            />
          ) : (
            <Globe className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {currentSite ? formatHost(currentSite.canonicalHost) : tNav("selectSite")}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="max-h-[300px] overflow-y-auto">
            {sites.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {tNav("noSites")}
              </div>
            ) : (
              sites.map((site) => {
                const isSelected = site.id === currentSiteId;

                return (
                  <button
                    key={site.id}
                    onClick={() => {
                      onSiteChange?.(site.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/50 transition-colors ${
                      isSelected ? "bg-blue-500/10" : ""
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden">
                      {site.lastFaviconUrl ? (
                        <img
                          src={site.lastFaviconUrl}
                          alt={formatHost(site.canonicalHost)}
                          className="w-5 h-5"
                        />
                      ) : (
                        <Globe className="h-4 w-4 text-gray-500" />
                      )}
                    </div>

                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {formatHost(site.canonicalHost)}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-700">
            <Link
              href="/dashboard/sites/add"
              className="flex items-center gap-3 px-3 py-2.5 text-blue-300 hover:bg-gray-800/50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <div className="p-1.5 rounded-lg border border-blue-500/30 bg-blue-500/15">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">{tNav("addNewSite")}</span>
            </Link>
          </div>
        </div>
      )}

      {currentSite && !isOpen && (
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {tNav("optimize")}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-gray-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {isConnected ? (
                <span>{tNav("connected")}</span>
              ) : (
                <Link
                  href={`/dashboard/sites/connect?siteId=${currentSite.id}`}
                  className="text-amber-300 hover:text-amber-200 underline underline-offset-2"
                >
                  {tNav("connectNow")}
                </Link>
              )}
            </div>
          </div>
          {CATEGORY_LINKS.map((category) => {
            const Icon = category.icon;
            const href = category.href(currentSite.id);
            const isActive = pathname.includes(category.id);

            return (
              <Link
                key={category.id}
                href={href}
                className={`cockpit-nav-item flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? "cockpit-nav-item--active" : "hover:text-gray-200"
                }`}
              >
                <span className={`inline-flex items-center justify-center rounded-md p-1.5 ${category.iconBg}`}>
                  <Icon className={`h-4 w-4 ${category.color}`} />
                </span>
                <span className="text-sm flex items-center gap-2">
                  {tNav(category.labelKey)}
                  {category.id === "seo" && (
                    <span className="inline-flex items-center rounded-full border border-purple-400/50 bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-purple-200">
                      {tNav("geoNew")}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
