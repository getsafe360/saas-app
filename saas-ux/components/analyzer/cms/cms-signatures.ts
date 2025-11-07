// components/analyzer/cms/cms-signatures.ts
// Removed conflicting import because CMSSignature is declared locally in this file.
export type CMSSignature = {
  type: 'wordpress' | 'drupal' | 'joomla' | 'shopify' | 'wix' | 'squarespace' | 'custom';
  indicators: {
    headers?: string[];
    meta?: string[];
    paths?: string[];
    scripts?: string[];
  };
  checks: (facts: any) => boolean;
};

export const CMS_SIGNATURES: CMSSignature[] = [
  {
    type: 'wordpress',
    indicators: {
      paths: ['/wp-content/', '/wp-includes/', '/wp-json/'],
      meta: ['generator-wordpress'],
      scripts: ['wp-embed.min.js', 'jquery/jquery.js?ver=']
    },
    checks: (facts) => facts?.cms?.type === 'wordpress'
  },
  {
    type: 'shopify',
    indicators: {
      headers: ['x-shopify-stage'],
      scripts: ['cdn.shopify.com'],
    },
    checks: (facts) => facts?.platform?.includes('shopify')
  },
  // Add more CMS signatures...
];