import assert from 'node:assert/strict';
import test from 'node:test';

import { toCrawlPage, type SeoCrawl } from '@/lib/engine/seo/facts';
import { parseSeoPage } from '@/lib/engine/seo/page';
import { analyzeAnswer, isSiteHost, topCompetitors, visibilityScore } from './analyze';
import { brandTerms, buildSuggestPrompt, normalizeQuestions, parseSuggested, siteLanguage } from './questions';
import type { QuestionResult } from './types';

const crawl: SeoCrawl = {
  origin: 'https://www.baeckerei-mueller.de',
  checkedAt: '2026-11-14T00:00:00.000Z',
  robots: { status: 'ok', text: '', contentType: 'text/plain' },
  llms: { status: 'missing', text: null, contentType: null },
  sitemap: { status: 'missing', url: null, urlCount: 0, listedInRobots: false, hasLastmod: false },
  pages: [
    toCrawlPage(parseSeoPage('<html lang="de-DE"><head><title>Startseite | Bäckerei Müller</title><meta name="description" content="Familienbäckerei in Berlin-Mitte seit 1952."></head><body><main><h1>Bäckerei Müller</h1><p>Sauerteigbrot, Torten, Frühstück.</p></main></body></html>', 'https://www.baeckerei-mueller.de/'), true, true),
  ],
  pageErrors: 0,
};
const question = { id: 'q0', text: 'Beste Bäckerei in Berlin-Mitte?' };
const brands = brandTerms(crawl);

test('questions: language, brand terms, prompt keeps the site as data', () => {
  assert.equal(siteLanguage(crawl, 'en'), 'de');
  assert.equal(siteLanguage(null, 'fr'), 'fr');
  assert.deepEqual(brands, ['Bäckerei Müller', 'baeckerei-mueller.de']);
  const prompt = buildSuggestPrompt(crawl, 'de');
  assert.match(prompt.system, /in German/);
  assert.match(prompt.system, /Never name the business/);
  assert.match(prompt.user, /^<site>[\s\S]*<\/site>$/);
});

test('questions: suggestions parsed, cleaned, never naming the site, capped', () => {
  const reply = 'Here you go:\n```json\n["Beste Bäckerei in Berlin-Mitte?", "beste bäckerei in berlin-mitte?", "Ist Bäckerei Müller gut?", "kurz", "Wo gibt es Sauerteigbrot in Berlin?", "Frühstück in Mitte am Sonntag?"]\n```';
  const questions = normalizeQuestions(parseSuggested(reply), 3, brands);
  assert.deepEqual(questions.map((q) => q.text), ['Beste Bäckerei in Berlin-Mitte?', 'Wo gibt es Sauerteigbrot in Berlin?', 'Frühstück in Mitte am Sonntag?']);
  assert.equal(new Set(questions.map((q) => q.id)).size, 3, 'ids are unique');
  assert.deepEqual(parseSuggested('no json here'), []);
  assert.equal(normalizeQuestions([42, 'x'.repeat(200)], 5).length, 0);
});

test('answer analysis: cited, mentioned, found, other sources measured from the response', () => {
  const blocks = [
    { type: 'server_tool_use' },
    { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://www.baeckerei-mueller.de/brot/' }, { url: 'https://www.tripadvisor.de/x' }] },
    { type: 'text', text: 'In Berlin-Mitte sind mehrere Bäckereien beliebt. ' },
    { type: 'text', text: 'Die Bäckerei Müller backt seit 1952 Sauerteigbrot.', citations: [{ type: 'web_search_result_location', url: 'https://baeckerei-mueller.de/ueber-uns/' }] },
    { type: 'text', text: ' Auch Zeit für Brot ist bekannt.', citations: [{ url: 'https://www.tripadvisor.de/a' }, { url: 'https://zeitfuerbrot.com/' }, { url: 'https://tripadvisor.de/b' }] },
  ];
  const result = analyzeAnswer({ question, blocks, siteHost: 'www.baeckerei-mueller.de', brands, searches: 2 });
  assert.equal(result.cited, true);
  assert.equal(result.mentioned, true);
  assert.equal(result.foundInSearch, true);
  assert.deepEqual(result.citedUrls, ['https://baeckerei-mueller.de/ueber-uns/']);
  assert.deepEqual(result.otherSources, [{ host: 'tripadvisor.de', count: 2 }, { host: 'zeitfuerbrot.com', count: 1 }]);
  assert.match(result.excerpt, /^Die Bäckerei Müller backt seit 1952/);
});

test('answer analysis: no false mentions inside other words, found-but-not-cited kept apart', () => {
  const blocks = [
    { type: 'web_search_tool_result', content: [{ url: 'https://shop.baeckerei-mueller.de/' }] },
    { type: 'text', text: 'Try Bäckerei Müllerhaus or Kaiserbäckerei Müller-Schmidt.', citations: [{ url: 'https://other.example/' }] },
  ];
  const result = analyzeAnswer({ question, blocks, siteHost: 'baeckerei-mueller.de', brands: ['Bäckerei Müller'], searches: 1 });
  assert.equal(result.mentioned, false, '"Müllerhaus" is not "Müller"');
  assert.equal(result.cited, false);
  assert.equal(result.foundInSearch, true, 'a subdomain counts as the site');
  assert.equal(isSiteHost('evilbaeckerei-mueller.de', 'baeckerei-mueller.de'), false);
});

test('score and competitors across a run', () => {
  const r = (cited: boolean, mentioned: boolean, hosts: string[] = [], error?: 'ANSWER_FAILED'): QuestionResult => ({
    questionId: 'q', question: 'q', cited, mentioned, foundInSearch: cited, citedUrls: [], searches: 1, excerpt: '',
    otherSources: hosts.map((host) => ({ host, count: 1 })), ...(error ? { error } : {}),
  });
  assert.equal(visibilityScore([r(true, true), r(false, true), r(false, false), r(false, false)]), 38);
  assert.equal(visibilityScore([r(true, true), r(false, false, [], 'ANSWER_FAILED')]), 100, 'failed answers do not count');
  assert.equal(visibilityScore([]), 0);
  assert.deepEqual(topCompetitors({ results: [r(false, false, ['a.de', 'b.de']), r(false, false, ['b.de'])] }), [{ host: 'b.de', questions: 2 }, { host: 'a.de', questions: 1 }]);
});
