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
  FileText,
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
    content?: number;
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
    color: "var(--category-performance)",
    iconBg: "oklch(from var(--category-performance) l c h / 0.15)",
    href: (siteId: string) =>
      `/dashboard/sites/${siteId}/cockpit?category=performance`,
  },
  {
    id: "security",
    labelKey: "security",
    icon: Shield,
    color: "var(--category-security)",
    iconBg: "oklch(from var(--category-security) l c h / 0.15)",
    href: (siteId: string) =>
      `/dashboard/sites/${siteId}/cockpit?category=security`,
  },
  {
    id: "seo",
    labelKey: "seo",
    icon: Search,
    color: "var(--category-seo)",
    iconBg: "oklch(from var(--category-seo) l c h / 0.15)",
    href: (siteId: string) => `/dashboard/sites/${siteId}/cockpit?category=seo`,
  },
  {
    id: "accessibility",
    labelKey: "accessibility",
    icon: Accessibility,
    color: "var(--category-accessibility)",
    iconBg: "oklch(from var(--category-accessibility) l c h / 0.15)",
    href: (siteId: string) =>
      `/dashboard/sites/${siteId}/cockpit?category=accessibility`,
  },
  {
    id: "content",
    labelKey: "content",
    icon: FileText,
    color: "var(--category-content)",
    iconBg: "oklch(from var(--category-content) l c h / 0.15)",
    href: (siteId: string) => `/dashboard/content?siteId=${siteId}`,
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
          isOpen
            ? "border-[var(--border-primary)] bg-[var(--cockpit-sidebar-item-active-bg)]"
            : "border-[var(--border-default)] bg-[var(--card-bg)] hover:border-[var(--color-neutral-400)]"
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-[var(--color-neutral-200)] flex items-center justify-center overflow-hidden">
          {currentSite?.lastFaviconUrl ? (
            <img
              src={currentSite.lastFaviconUrl}
              alt={formatHost(currentSite.canonicalHost)}
              className="w-5 h-5"
            />
          ) : (
            <Globe className="h-4 w-4 text-[var(--text-subtle)]" />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-[var(--text-default)] truncate">
            {currentSite
              ? formatHost(currentSite.canonicalHost)
              : tNav("selectSite")}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[var(--text-subtle)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-[var(--background-default)] border border-[var(--border-default)] rounded-xl shadow-xl z-50 overflow-hidden transition-colors duration-200">
          <div className="max-h-[300px] overflow-y-auto">
            {sites.length === 0 ? (
              <div className="p-4 text-center text-[var(--text-subtle)] text-sm">
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--cockpit-sidebar-item-hover-bg)] transition-colors ${
                      isSelected ? "bg-[var(--cockpit-sidebar-item-active-bg)]" : ""
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-neutral-200)] flex items-center justify-center overflow-hidden">
                      {site.lastFaviconUrl ? (
                        <img
                          src={site.lastFaviconUrl}
                          alt={formatHost(site.canonicalHost)}
                          className="w-5 h-5"
                        />
                      ) : (
                        <Globe className="h-4 w-4 text-[var(--text-subtle)]" />
                      )}
                    </div>

                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium text-[var(--text-default)] truncate">
                        {formatHost(site.canonicalHost)}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-[var(--text-primary)] flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-[var(--border-default)]">
            <Link
              href="/dashboard/sites/add"
              className="flex items-center gap-3 px-3 py-2.5 text-[var(--text-primary)] hover:bg-[var(--cockpit-sidebar-item-hover-bg)] transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <div
                className="p-1.5 rounded-lg border"
                style={{
                  borderColor: "oklch(from var(--color-primary-500) l c h / 0.4)",
                  background: "oklch(from var(--color-primary-500) l c h / 0.12)",
                }}
              >
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
            <span className="text-xs font-medium text-[var(--text-subtle)] uppercase tracking-wider">
              {tNav("optimize")}
            </span>
            {currentSite.status !== "connected" && (
              <Link
                href={`/dashboard/sites/connect?siteId=${currentSite.id}`}
                className="text-xs text-amber-600 dark:text-amber-300 hover:text-amber-700 dark:hover:text-amber-200 underline underline-offset-2"
              >
                {tNav("connectNow")}
              </Link>
            )}
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
                  isActive ? "cockpit-nav-item--active" : "hover:text-[var(--text-default)]"
                }`}
              >
                <span
                  className="inline-flex items-center justify-center rounded-md p-1.5"
                  style={{ background: category.iconBg }}
                >
                  <Icon className="h-4 w-4" style={{ color: category.color }} />
                </span>
                <span className="text-sm">{tNav(category.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
