// components/analyzer/cms/cms-signatures.ts
// Comprehensive CMS detection signatures with display information
import { WordPressIcon } from "../../icons/WordPress";
import { ShopifyIcon } from "../../icons/Shopify";
import { DrupalIcon } from "../../icons/Drupal";
import { MagentoIcon } from "../../icons/Magento";
import { WebflowIcon } from "../../icons/Webflow";
import { WixIcon } from "../../icons/Wix";
import { JoomlaIcon } from "../../icons/Joomla";
import type { ComponentType } from 'react';

export type CMSSignature = {
  type: 'wordpress' | 'drupal' | 'joomla' | 'shopify' | 'wix' | 'squarespace' | 'hubspot' | 'magento' | 'webflow' | 'contentful' | 'ghost' | 'strapi' | 'custom';
  name: string; // Display name for UI
  icon?: string | ComponentType<{ size?: number; className?: string }>; // Icon component or emoji
  iconEmoji?: string; // Emoji fallback for environments without icon components
  indicators: {
    headers?: string[];
    meta?: string[];
    paths?: string[];
    scripts?: string[];
    cookies?: string[];
    dom?: string[]; // CSS selectors or data attributes
  };
  checks: (facts: any) => boolean;
};

export const CMS_SIGNATURES: CMSSignature[] = [
  {
    type: 'wordpress',
    name: 'WordPress',
    icon: WordPressIcon, // React component
    iconEmoji: '📝', // Fallback emoji
    indicators: {
      paths: ['/wp-content/', '/wp-includes/', '/wp-json/', '/wp-admin/'],
      meta: ['generator-wordpress', 'wordpress'],
      scripts: ['wp-embed.min.js', 'jquery/jquery.js?ver=', 'wp-emoji-release.min.js'],
      dom: ['link[href*="wp-content"]', 'link[href*="wp-includes"]']
    },
    checks: (facts) => facts?.cms?.type === 'wordpress' || facts?.generator?.toLowerCase().includes('wordpress')
  },
  {
    type: 'shopify',
    name: 'Shopify',
    icon: ShopifyIcon, // React component
    iconEmoji: '🛍️', // Fallback emoji
    indicators: {
      headers: ['x-shopify-stage', 'x-shopify-shop-api-call-limit'],
      scripts: ['cdn.shopify.com', 'shopify.com/s/files'],
      meta: ['shopify'],
      dom: ['[data-shopify]', '#shopify-section']
    },
    checks: (facts) => facts?.platform?.includes('shopify') || facts?.ecommerce?.platform === 'shopify'
  },
  {
    type: 'drupal',
    name: 'Drupal',
    icon: DrupalIcon, // React component
    iconEmoji: '💧', // Fallback emoji
    indicators: {
      paths: ['/sites/default/', '/sites/all/', '/core/'],
      meta: ['generator-drupal', 'drupal'],
      headers: ['x-drupal-cache', 'x-drupal-dynamic-cache'],
      scripts: ['drupal.js', 'drupalSettings'],
      dom: ['[data-drupal-selector]']
    },
    checks: (facts) => facts?.cms?.type === 'drupal' || facts?.generator?.toLowerCase().includes('drupal')
  },
  {
    type: 'magento',
    name: 'Magento',
    icon: MagentoIcon, // React component
    iconEmoji: '🛒', // Fallback emoji
    indicators: {
      paths: ['/skin/', '/js/mage/', '/media/'],
      scripts: ['mage/cookies.js', 'magento'],
      cookies: ['MAGE_', 'frontend'],
      dom: ['[data-mage-init]']
    },
    checks: (facts) => facts?.ecommerce?.platform === 'magento' || facts?.platform?.includes('magento')
  },
  {
    type: 'webflow',
    name: 'Webflow',
    icon: WebflowIcon, // React component
    iconEmoji: '🌊', // Fallback emoji
    indicators: {
      scripts: ['webflow.com', 'assets.website-files.com'],
      meta: ['generator-webflow'],
      dom: ['[data-wf-page]', '[data-wf-site]']
    },
    checks: (facts) => facts?.platform?.includes('webflow') || facts?.hosting?.includes('webflow')
  },
  {
    type: 'wix',
    name: 'Wix',
    icon: WixIcon, // React component
    iconEmoji: '✨', // Fallback emoji
    indicators: {
      headers: ['x-wix-request-id', 'x-wix-renderer-server'],
      scripts: ['static.parastorage.com', 'wix.com'],
      meta: ['wix.com', 'generator-wix'],
      dom: ['[data-wix]']
    },
    checks: (facts) => facts?.platform?.includes('wix') || facts?.hosting?.includes('wix')
  },
  {
    type: 'joomla',
    name: 'Joomla',
    icon: JoomlaIcon, // React component (multi-colored)
    iconEmoji: '🔷', // Fallback emoji
    indicators: {
      paths: ['/components/', '/modules/', '/plugins/', '/templates/', '/administrator/'],
      meta: ['generator-joomla'],
      scripts: ['joomla.js', '/media/jui/js/'],
      dom: ['[data-joomla]']
    },
    checks: (facts) => facts?.cms?.type === 'joomla' || facts?.generator?.toLowerCase().includes('joomla')
  },
  {
    type: 'squarespace',
    name: 'Squarespace',
    iconEmoji: '⬛',
    indicators: {
      headers: ['x-squarespace-renderer'],
      scripts: ['static1.squarespace.com', 'squarespace.com'],
      meta: ['squarespace'],
      dom: ['[data-controller="Squarespace"]', '.sqs-system']
    },
    checks: (facts) => facts?.platform?.includes('squarespace') || facts?.hosting?.includes('squarespace')
  },
  {
    type: 'hubspot',
    name: 'HubSpot',
    iconEmoji: '🧲',
    indicators: {
      scripts: ['js.hs-scripts.com', 'js.hubspot.com', 'js.hs-analytics.net'],
      meta: ['generator-hubspot'],
      dom: ['[data-hsjs-portal]', '[id*="hubspot"]']
    },
    checks: (facts) => facts?.analytics?.includes('hubspot') || facts?.platform?.includes('hubspot')
  },
  {
    type: 'contentful',
    name: 'Contentful',
    iconEmoji: '📦',
    indicators: {
      scripts: ['contentful.com', 'ctfassets.net'],
      dom: ['[data-contentful]']
    },
    checks: (facts) => facts?.cms?.type === 'contentful' || facts?.headless?.includes('contentful')
  },
  {
    type: 'ghost',
    name: 'Ghost',
    iconEmoji: '👻',
    indicators: {
      meta: ['generator-ghost'],
      paths: ['/ghost/api/', '/content/'],
      scripts: ['ghost.js']
    },
    checks: (facts) => facts?.cms?.type === 'ghost' || facts?.generator?.toLowerCase().includes('ghost')
  },
  {
    type: 'strapi',
    name: 'Strapi',
    iconEmoji: '🚀',
    indicators: {
      headers: ['x-powered-by-strapi'],
      paths: ['/api/', '/admin/'],
      scripts: ['strapi']
    },
    checks: (facts) => facts?.cms?.type === 'strapi' || facts?.headless?.includes('strapi')
  },
  {
    type: 'custom',
    name: 'Custom/Unknown',
    iconEmoji: '🔧',
    indicators: {},
    checks: () => true // Fallback for undetected CMS
  }
];

// Helper function to get CMS info by type
export const getCMSInfo = (type: CMSSignature['type']): CMSSignature | undefined => {
  return CMS_SIGNATURES.find(sig => sig.type === type) || CMS_SIGNATURES.find(sig => sig.type === 'custom');
};

// Helper function to detect CMS from facts
export const detectCMS = (facts: any): CMSSignature | null => {
  for (const signature of CMS_SIGNATURES) {
    if (signature.type === 'custom') continue; // Skip fallback in detection
    if (signature.checks(facts)) {
      return signature;
    }
  }
  return CMS_SIGNATURES.find(sig => sig.type === 'custom') || null;
};

// Helper function to match CMS based on indicators
export const matchCMSIndicators = (detectedIndicators: {
  headers?: string[];
  meta?: string[];
  paths?: string[];
  scripts?: string[];
  cookies?: string[];
  dom?: string[];
}): CMSSignature[] => {
  const matches: CMSSignature[] = [];

  for (const signature of CMS_SIGNATURES) {
    if (signature.type === 'custom') continue;

    let score = 0;
    let maxScore = 0;

    // Check each indicator type
    Object.keys(signature.indicators).forEach(key => {
      const indicatorKey = key as keyof typeof signature.indicators;
      const signatureIndicators = signature.indicators[indicatorKey] || [];
      const detected = detectedIndicators[indicatorKey] || [];

      if (signatureIndicators.length > 0) {
        maxScore += signatureIndicators.length;
        
        signatureIndicators.forEach(indicator => {
          if (detected.some(d => d.toLowerCase().includes(indicator.toLowerCase()))) {
            score++;
          }
        });
      }
    });

    // If we have matches, add to results
    if (score > 0) {
      matches.push(signature);
    }
  }

  // Sort by confidence (most matches first)
  return matches.sort((a, b) => {
    const scoreA = calculateScore(a, detectedIndicators);
    const scoreB = calculateScore(b, detectedIndicators);
    return scoreB - scoreA;
  });
};

// Calculate match score for a signature
const calculateScore = (signature: CMSSignature, detectedIndicators: any): number => {
  let score = 0;
  
  Object.keys(signature.indicators).forEach(key => {
    const indicatorKey = key as keyof typeof signature.indicators;
    const signatureIndicators = signature.indicators[indicatorKey] || [];
    const detected = detectedIndicators[indicatorKey] || [];

    signatureIndicators.forEach(indicator => {
      if (detected.some((d: string) => d.toLowerCase().includes(indicator.toLowerCase()))) {
        score++;
      }
    });
  });

  return score;
};