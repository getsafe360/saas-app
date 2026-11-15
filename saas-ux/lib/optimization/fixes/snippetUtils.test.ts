import assert from 'node:assert/strict';
import test from 'node:test';
import { isPageSpecificHeadSnippet } from './snippetUtils';

test('page-specific head tags are recognised, site-wide ones are not', () => {
  for (const snippet of [
    '<link rel="canonical" href="https://a.de/">',
    "<meta name='description' content='x'>",
    '<meta property="og:title" content="x"><meta property="og:type" content="website">',
    '<meta property="og:url" content="https://a.de/">',
    '<meta name="twitter:description" content="x">',
  ]) assert.equal(isPageSpecificHeadSnippet(snippet), true, snippet);
  for (const snippet of [
    '<script type="application/ld+json">{"@type":"Organization"}</script>',
    '<meta property="og:site_name" content="A">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="description-x" content="y">',
    '<link rel="preconnect" href="https://fonts.gstatic.com">',
  ]) assert.equal(isPageSpecificHeadSnippet(snippet), false, snippet);
});
