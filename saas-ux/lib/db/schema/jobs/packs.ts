// lib/db/schema/jobs/packs.ts
// Pack run jobs

import {
  pgTable, uuid, text, timestamp, index
} from 'drizzle-orm/pg-core';
import { jobStatusEnum } from '../_shared/enums';
import { sites } from '../sites/sites';
import { appPacks } from '../packs/catalog';

export const packRuns = pgTable('pack_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  packId: uuid('pack_id').notNull().references(() => appPacks.id, { onDelete: 'cascade' }),
  status: jobStatusEnum('status').notNull().default('queued'),
  resultBlobKey: text('result_blob_key'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
}, (t) => ({
  bySite: index('pack_runs_site_idx').on(t.siteId),
  byPack: index('pack_runs_pack_idx').on(t.packId),
}));
