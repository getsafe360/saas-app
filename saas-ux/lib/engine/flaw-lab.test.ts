// Keeps the flaw lab (tests/flaw-lab) in step with the rule catalogs: every
// finding it promises must be a real rule, every fixer a real fixer with the
// same automation, and the manifest must list exactly the flaws the seeder has.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import type { Rule } from './rules';
import { PAGE_RULES } from './page/rules';
import { SEO_GEO_RULES } from './seo/rules';
import { WORDPRESS_RULES } from './wordpress/rules';
import { SECURITY_HEADER_RULES } from './security/headers';
import { AUTOMATIC_FIXER_IDS, PERMANENT_FIXER_IDS } from './fixers/catalog';

const LAB = join(__dirname, '..', '..', 'tests', 'flaw-lab');

type Scope = 'home' | 'crawl' | 'connector' | 'headers';
type FindingRef = { rule: string; scope: Scope };
type Flaw = {
  id: string;
  category: string;
  optIn?: boolean;
  explicitOnly?: boolean;
  findings: FindingRef[];
  alsoShows?: FindingRef[];
  fix: { fixerId: string | null; automation: 'auto' | 'click' | 'manual'; how: string };
  afterFix: string;
  afterUndo: string;
};
type Manifest = {
  flaws: Flaw[];
  baseline: { findings: Array<FindingRef & { fixerId: string | null; automation: string }> };
  notSeeded: Array<{ rule: string; reason: string }>;
};

const manifest = JSON.parse(readFileSync(join(LAB, 'expected.json'), 'utf8')) as Manifest;
const seeder = readFileSync(join(LAB, 'gs360-flaw-lab.php'), 'utf8');

const CATALOGS: Record<Scope, ReadonlyArray<Rule<never>>> = {
  home: PAGE_RULES as ReadonlyArray<Rule<never>>,
  crawl: SEO_GEO_RULES as ReadonlyArray<Rule<never>>,
  connector: WORDPRESS_RULES as ReadonlyArray<Rule<never>>,
  headers: SECURITY_HEADER_RULES as ReadonlyArray<Rule<never>>,
};
const ALL_RULES = Object.values(CATALOGS).flat();

function ruleIn(ref: FindingRef) {
  return CATALOGS[ref.scope]?.find((rule) => rule.id === ref.rule);
}

/** The FLAWS constant of the seeder: id => category. */
function seederFlaws(): Map<string, string> {
  const block = seeder.match(/const FLAWS = \[([\s\S]*?)\n\s*\];/);
  assert.ok(block, 'FLAWS constant not found in gs360-flaw-lab.php');
  const flaws = new Map<string, string>();
  for (const m of block[1].matchAll(/'([a-z0-9-]+)'\s*=>\s*\['([a-z]+)'/g)) flaws.set(m[1], m[2]);
  return flaws;
}

test('the manifest lists exactly the flaws the seeder can seed, in the same categories', () => {
  const seeded = seederFlaws();
  assert.deepEqual(manifest.flaws.map((flaw) => flaw.id).sort(), [...seeded.keys()].sort());
  for (const flaw of manifest.flaws) assert.equal(flaw.category, seeded.get(flaw.id), flaw.id);
});

test('opt-in and named-only flags match the seeder', () => {
  const optInCategories = seeder.match(/const OPT_IN = \[([^\]]*)\]/)?.[1] ?? '';
  const explicit = seeder.match(/const EXPLICIT = \[([^\]]*)\]/)?.[1] ?? '';
  for (const flaw of manifest.flaws) {
    assert.equal(Boolean(flaw.optIn), optInCategories.includes(`'${flaw.category}'`), `${flaw.id} optIn`);
    assert.equal(Boolean(flaw.explicitOnly), explicit.includes(`'${flaw.id}'`), `${flaw.id} explicitOnly`);
  }
});

test('every expected finding is a rule in the catalog of its scope', () => {
  for (const flaw of manifest.flaws) {
    assert.ok(flaw.findings.length > 0, `${flaw.id} expects no finding`);
    for (const ref of [...flaw.findings, ...(flaw.alsoShows ?? [])]) {
      assert.ok(ruleIn(ref), `${flaw.id}: ${ref.rule} is not in the ${ref.scope} rules`);
    }
  }
  for (const ref of manifest.baseline.findings) assert.ok(ruleIn(ref), `baseline: ${ref.rule} is not in the ${ref.scope} rules`);
  for (const { rule } of manifest.notSeeded) {
    assert.ok(ALL_RULES.some((r) => r.id === rule), `notSeeded: ${rule} is unknown`);
  }
});

test('fixers named in the manifest are the ones the rules point to', () => {
  for (const flaw of manifest.flaws) {
    const { fixerId, automation } = flaw.fix;
    const fixRefs = flaw.findings.map((ref) => ruleIn(ref)?.fix).filter(Boolean);
    if (fixerId === null) {
      assert.notEqual(automation, 'auto', `${flaw.id}: auto needs a fixer`);
      continue;
    }
    assert.ok(fixRefs.some((fix) => fix?.fixerId === fixerId), `${flaw.id}: no expected finding is fixed by ${fixerId}`);
    if (automation === 'auto') {
      assert.ok(AUTOMATIC_FIXER_IDS.has(fixerId), `${flaw.id}: ${fixerId} is not an automatic fixer`);
    } else {
      assert.ok(!AUTOMATIC_FIXER_IDS.has(fixerId), `${flaw.id}: ${fixerId} is automatic, manifest says ${automation}`);
    }
  }
  for (const ref of manifest.baseline.findings) {
    if (ref.fixerId) assert.equal(ruleIn(ref)?.fix?.fixerId, ref.fixerId, `baseline: ${ref.rule}`);
  }
});

test('undo expectations match whether the fixer is permanent', () => {
  for (const flaw of manifest.flaws) {
    const { fixerId, automation } = flaw.fix;
    if (automation !== 'auto' || !fixerId) continue;
    const permanent = PERMANENT_FIXER_IDS.has(fixerId);
    assert.equal(/permanent/.test(flaw.afterUndo), permanent, `${flaw.id}: afterUndo should ${permanent ? '' : 'not '}say permanent`);
  }
});
