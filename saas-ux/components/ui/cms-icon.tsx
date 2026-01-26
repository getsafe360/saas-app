// components/ui/cms-icon.tsx
"use client";

import { getCMSIcon } from "@/lib/cms-icons";
import { Globe } from "lucide-react";

interface CMSIconProps {
  cms: string | null | undefined;
  className?: string;
  size?: number;
  showFallback?: boolean;
}

/**
 * Renders a CMS-specific icon using simple-icons
 * Falls back to Globe icon if CMS is not recognized
 */
export function CMSIcon({
  cms,
  className = "",
  size = 20,
  showFallback = true,
}: CMSIconProps) {
  const iconData = getCMSIcon(cms);

  // Fallback to Globe icon if CMS not found
  if (!iconData) {
    if (!showFallback) return null;
    return <Globe className={className} style={{ width: size, height: size }} />;
  }

  // Render Simple Icons SVG (if available)
  if (iconData.icon) {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ width: size, height: size }}
        aria-label={iconData.name}
      >
        <title>{iconData.name}</title>
        <path d={iconData.icon.path} fill={iconData.color} />
      </svg>
    );
  }

  // Render custom SVG markup (if available)
  if (iconData.svg) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: iconData.svg }}
      />
    );
  }

  // Final fallback to Globe icon
  if (!showFallback) return null;
  return <Globe className={className} style={{ width: size, height: size }} />;
}
