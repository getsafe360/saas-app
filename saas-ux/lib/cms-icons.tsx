// lib/cms-icons.tsx
// CMS → Icon mapping layer for reliable icon display

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
} from "simple-icons";

export interface CMSIconData {
  icon: typeof siWordpress; // All icons follow this structure
  color: string;
  name: string;
}

// CMS name normalization (handles variations)
function normalizeCMSName(cms: string | null | undefined): string {
  if (!cms) return "";
  return cms.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

// CMS → Icon mapping
const CMS_ICONS: Record<string, CMSIconData> = {
  wordpress: {
    icon: siWordpress,
    color: "#21759B",
    name: "WordPress",
  },
  woocommerce: {
    icon: siWoocommerce,
    color: "#96588A",
    name: "WooCommerce",
  },
  shopify: {
    icon: siShopify,
    color: "#7AB55C",
    name: "Shopify",
  },
  wix: {
    icon: siWix,
    color: "#0C6EFC",
    name: "Wix",
  },
  squarespace: {
    icon: siSquarespace,
    color: "#000000",
    name: "Squarespace",
  },
  webflow: {
    icon: siWebflow,
    color: "#4353FF",
    name: "Webflow",
  },
  joomla: {
    icon: siJoomla,
    color: "#5091CD",
    name: "Joomla",
  },
  drupal: {
    icon: siDrupal,
    color: "#0678BE",
    name: "Drupal",
  },
  magento: {
    icon: siShopify, // Using Shopify as fallback (similar e-commerce platform)
    color: "#EE672F",
    name: "Magento",
  },
  adobecommerce: {
    icon: siShopify, // Using Shopify as fallback (similar e-commerce platform)
    color: "#EE672F",
    name: "Adobe Commerce",
  },
  prestashop: {
    icon: siPrestashop,
    color: "#DF0067",
    name: "PrestaShop",
  },
  bigcommerce: {
    icon: siBigcommerce,
    color: "#121118",
    name: "BigCommerce",
  },
  weebly: {
    icon: siWeebly,
    color: "#4CABD7",
    name: "Weebly",
  },
  duda: {
    icon: siWebflow, // Using Webflow as fallback (similar service)
    color: "#0C91E7",
    name: "Duda",
  },
  typo3: {
    icon: siTypo3,
    color: "#FF8700",
    name: "TYPO3",
  },
  ghost: {
    icon: siGhost,
    color: "#15171A",
    name: "Ghost",
  },
  craftcms: {
    icon: siWebflow, // Using as fallback
    color: "#E5422B",
    name: "Craft CMS",
  },
  craft: {
    icon: siWebflow, // Using as fallback
    color: "#E5422B",
    name: "Craft CMS",
  },
  hubspot: {
    icon: siHubspot,
    color: "#FF7A59",
    name: "HubSpot",
  },
  sharepoint: {
    icon: siMicrosoftsharepoint,
    color: "#0078D4",
    name: "SharePoint",
  },
  contentful: {
    icon: siContentful,
    color: "#2478CC",
    name: "Contentful",
  },
  strapi: {
    icon: siStrapi,
    color: "#2F2E8B",
    name: "Strapi",
  },
  sanity: {
    icon: siSanity,
    color: "#F03E2F",
    name: "Sanity",
  },
  storyblok: {
    icon: siStoryblok,
    color: "#09B3AF",
    name: "Storyblok",
  },
};

/**
 * Get CMS icon data for a given CMS type
 * @param cms - CMS name (case-insensitive, handles variations)
 * @returns Icon data or null if not found
 */
export function getCMSIcon(cms: string | null | undefined): CMSIconData | null {
  const normalized = normalizeCMSName(cms);
  if (!normalized) return null;

  return CMS_ICONS[normalized] || null;
}

/**
 * Get all supported CMS types
 */
export function getSupportedCMSTypes(): string[] {
  return Object.values(CMS_ICONS).map((data) => data.name);
}

/**
 * Check if a CMS type is supported
 */
export function isCMSSupported(cms: string | null | undefined): boolean {
  return getCMSIcon(cms) !== null;
}
