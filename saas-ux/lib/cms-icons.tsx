// lib/cms-icons.tsx
// CMS → Icon mapping layer for reliable icon display (Simple Icons)

import type { SimpleIcon } from "simple-icons";
import {
  siWordpress,
  siWoocommerce,
  siShopify,
  siWix,
  siSquarespace,
  siWebflow,
  siJoomla,
  siDrupal,
  siPrestashop,
  siBigcommerce,
  siWeebly,
  siTypo3,
  siGhost,
  siHubspot,
  siMicrosoftsharepoint,
  siContentful,
  siStrapi,
  siSanity,
  siStoryblok,
  siMagento,
  siCraftcms,
} from "simple-icons";

/**
 * For platforms not present in Simple Icons, we fall back to a generic glyph.
 * Keep it tiny + neutral so it doesn't mislead users.
 */
const GENERIC_CMS_SVG = `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2z"/>
</svg>`;

export interface CMSIconData {
  /** Canonical CMS key you use in your system */
  key: string;

  /** Display name (defaults to icon.title when icon exists) */
  name: string;

  /**
   * Brand color (defaults to icon.hex when icon exists).
   * Always stored WITH leading '#'.
   */
  color: string;

  /**
   * Simple Icons object when available.
   * If undefined, use `svg` for a generic/custom icon.
   */
  icon?: SimpleIcon;

  /** SVG markup when icon isn't in Simple Icons (or you prefer custom) */
  svg?: string;
}

/** CMS name normalization (handles variations) */
function normalizeCMSName(cms: string | null | undefined): string {
  if (!cms) return "";
  return cms.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

/** Helper: convert Simple Icons hex -> CSS color */
function iconHexToColor(icon: SimpleIcon): string {
  // simple-icons uses hex without '#'
  return `#${icon.hex}`;
}

/**
 * Canonical icon registry.
 * Only put "real" icons here. Aliases go into ALIASES below.
 */
const REGISTRY: Record<string, Omit<CMSIconData, "key">> = {
  wordpress: { icon: siWordpress, name: siWordpress.title, color: iconHexToColor(siWordpress) },
  woocommerce: { icon: siWoocommerce, name: siWoocommerce.title, color: iconHexToColor(siWoocommerce) },
  shopify: { icon: siShopify, name: siShopify.title, color: iconHexToColor(siShopify) },
  wix: { icon: siWix, name: siWix.title, color: iconHexToColor(siWix) },
  squarespace: { icon: siSquarespace, name: siSquarespace.title, color: iconHexToColor(siSquarespace) },
  webflow: { icon: siWebflow, name: siWebflow.title, color: iconHexToColor(siWebflow) },
  joomla: { icon: siJoomla, name: siJoomla.title, color: iconHexToColor(siJoomla) },
  drupal: { icon: siDrupal, name: siDrupal.title, color: iconHexToColor(siDrupal) },

  // E-commerce / CMS that actually exist in Simple Icons:
  magento: { icon: siMagento, name: siMagento.title, color: iconHexToColor(siMagento) },
  prestashop: { icon: siPrestashop, name: siPrestashop.title, color: iconHexToColor(siPrestashop) },
  bigcommerce: { icon: siBigcommerce, name: siBigcommerce.title, color: iconHexToColor(siBigcommerce) },

  weebly: { icon: siWeebly, name: siWeebly.title, color: iconHexToColor(siWeebly) },
  typo3: { icon: siTypo3, name: siTypo3.title, color: iconHexToColor(siTypo3) },
  ghost: { icon: siGhost, name: siGhost.title, color: iconHexToColor(siGhost) },
  hubspot: { icon: siHubspot, name: siHubspot.title, color: iconHexToColor(siHubspot) },
  sharepoint: { icon: siMicrosoftsharepoint, name: "SharePoint", color: iconHexToColor(siMicrosoftsharepoint) },
  contentful: { icon: siContentful, name: siContentful.title, color: iconHexToColor(siContentful) },
  strapi: { icon: siStrapi, name: siStrapi.title, color: iconHexToColor(siStrapi) },
  sanity: { icon: siSanity, name: siSanity.title, color: iconHexToColor(siSanity) },
  storyblok: { icon: siStoryblok, name: siStoryblok.title, color: iconHexToColor(siStoryblok) },

  craftcms: { icon: siCraftcms, name: siCraftcms.title, color: iconHexToColor(siCraftcms) },

  // Not in Simple Icons? Keep as custom/generic.
  duda: { name: "Duda", color: "#0C91E7", svg: GENERIC_CMS_SVG },
};

/**
 * Aliases map normalized inputs to canonical REGISTRY keys.
 * This keeps your REGISTRY clean and avoids duplicate icon entries.
 */
const ALIASES: Record<string, keyof typeof REGISTRY> = {
  wp: "wordpress",
  wordpresscom: "wordpress",
  woocommerceplugin: "woocommerce",

  adobecommerce: "magento",
  adobecommercemagento: "magento",

  craft: "craftcms",
  craftcms: "craftcms",

  microsoftsharepoint: "sharepoint",
  sharepointonline: "sharepoint",
};

/**
 * Get CMS icon data for a given CMS type
 */
export function getCMSIcon(cms: string | null | undefined): CMSIconData | null {
  const normalized = normalizeCMSName(cms);
  if (!normalized) return null;

  const canonical = (ALIASES[normalized] ?? (normalized as keyof typeof REGISTRY));
  const entry = REGISTRY[canonical];
  if (!entry) return null;

  return { key: String(canonical), ...entry };
}

/**
 * Get all supported canonical CMS keys
 */
export function getSupportedCMSKeys(): string[] {
  return Object.keys(REGISTRY);
}

/**
 * Check if a CMS type is supported (either canonical or alias)
 */
export function isCMSSupported(cms: string | null | undefined): boolean {
  return getCMSIcon(cms) !== null;
}

/**
 * Optional helper to get SVG markup consistently.
 * - If Simple Icon exists, return its svg.
 * - Else return custom/generic svg.
 */
export function getCMSIconSvg(cms: string | null | undefined): { svg: string; color: string; name: string } | null {
  const data = getCMSIcon(cms);
  if (!data) return null;

  if (data.icon) return { svg: data.icon.svg, color: data.color, name: data.name };
  if (data.svg) return { svg: data.svg, color: data.color, name: data.name };

  return null;
}
