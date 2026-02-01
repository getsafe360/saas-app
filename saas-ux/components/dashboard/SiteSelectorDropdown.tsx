// components/dashboard/SiteSelectorDropdown.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Link } from "@/navigation";
import { usePathname } from "next/navigation";
import {
  Globe,
  ChevronDown,
  Plus,
  Zap,
  Shield,
  Search,
  Accessibility,
  ExternalLink,
  Check,
} from "lucide-react";

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

interface SiteSelectorDropdownProps {
  sites: SiteData[];
  currentSiteId?: string;
  onSiteChange?: (siteId: string) => void;
}

const CATEGORY_LINKS = [
  {
    id: "performance",
    label: "Performance",
    icon: Zap,
    href: (siteId: string) => `/dashboard/sites/${siteId}/cockpit?category=performance`,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    href: (siteId: string) => `/dashboard/sites/${siteId}/cockpit?category=security`,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  {
    id: "seo",
    label: "SEO",
    icon: Search,
    href: (siteId: string) => `/dashboard/sites/${siteId}/cockpit?category=seo`,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  {
    id: "accessibility",
    label: "Accessibility",
    icon: Accessibility,
    href: (siteId: string) => `/dashboard/sites/${siteId}/cockpit?category=accessibility`,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
  },
];

export function SiteSelectorDropdown({
  sites,
  currentSiteId,
  onSiteChange,
}: SiteSelectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const currentSite = sites.find((s) => s.id === currentSiteId);

  // Close dropdown when clicking outside
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

  // Close dropdown when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
          isOpen
            ? "border-blue-500 bg-blue-500/10"
            : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
        }`}
      >
        {/* Favicon or placeholder */}
        <div className="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center overflow-hidden">
          {currentSite?.lastFaviconUrl ? (
            <img
              src={currentSite.lastFaviconUrl}
              alt=""
              className="w-5 h-5"
            />
          ) : (
            <Globe className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {currentSite?.canonicalHost || "Select a site"}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Sites List */}
          <div className="max-h-[300px] overflow-y-auto">
            {sites.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No sites added yet
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
                    {/* Favicon or placeholder */}
                    <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden">
                      {site.lastFaviconUrl ? (
                        <img
                          src={site.lastFaviconUrl}
                          alt=""
                          className="w-5 h-5"
                        />
                      ) : (
                        <Globe className="h-4 w-4 text-gray-500" />
                      )}
                    </div>

                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {site.canonicalHost}
                      </div>
                    </div>

                    {/* Selected indicator */}
                    {isSelected && (
                      <Check className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Add Site Link */}
          <div className="border-t border-gray-700">
            <Link
              href="/dashboard/sites/add"
              className="flex items-center gap-3 px-3 py-2.5 text-blue-400 hover:bg-gray-800/50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Add New Site</span>
            </Link>
          </div>
        </div>
      )}

      {/* Category Links (show when site is selected) */}
      {currentSite && !isOpen && (
        <div className="mt-3 space-y-1">
          <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Optimize
          </div>
          {CATEGORY_LINKS.map((category) => {
            const Icon = category.icon;
            const href = category.href(currentSite.id);
            const isActive = pathname.includes(category.id);

            return (
              <Link
                key={category.id}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? `${category.bgColor} ${category.color}`
                    : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm">{category.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
