export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle';
import { getUser } from '@/lib/db/queries';
import { sites } from '@/lib/db/schema/sites/sites';
import { users } from '@/lib/db/schema/auth/users';
import type { WordPressConnection } from '@/lib/wordpress/auth';
import {
  createWordPressClient,
  WordPressErrorCode,
  type WordPressCapabilitiesResponse,
  type WordPressPullResponse,
  type WordPressStatusResponse,
} from '@/lib/wordpress/client';
import type {
  WordPressBuilder,
  WordPressCapabilitySummary,
  WordPressSeoPlugin,
  WordPressSiteSnapshot,
} from '@/lib/wordpress/types';

interface InspectRequestBody {
  siteId?: string;
}

interface InspectErrorPayload {
  code: string;
  title: string;
  message: string;
  action?: string;
  details?: string;
}

function normalizeThemeSlug(themeName: string): string {
  return themeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function detectBuilder(themeName: string, activePlugins: string[]): WordPressBuilder {
  const theme = themeName.toLowerCase();
  const plugins = activePlugins.map((plugin) => plugin.toLowerCase());

  if (theme.includes('divi') || plugins.some((plugin) => plugin.includes('divi') || plugin.includes('et-core-plugin'))) {
    return 'divi';
  }
  if (plugins.some((plugin) => plugin.includes('elementor'))) {
    return 'elementor';
  }
  if (plugins.some((plugin) => plugin.includes('bricks'))) {
    return 'bricks';
  }
  if (plugins.some((plugin) => plugin.includes('beaver-builder'))) {
    return 'beaver';
  }
  if (plugins.some((plugin) => plugin.includes('oxygen'))) {
    return 'oxygen';
  }
  if (plugins.some((plugin) => plugin.includes('gutenberg'))) {
    return 'gutenberg';
  }

  return 'unknown';
}

function detectSeoPlugin(activePlugins: string[]): WordPressSeoPlugin {
  const plugins = activePlugins.map((plugin) => plugin.toLowerCase());

  if (plugins.includes('wordpress-seo/wp-seo.php')) {
    return 'yoast';
  }
  if (plugins.includes('seo-by-rank-math/rank-math.php')) {
    return 'rankmath';
  }
  if (plugins.includes('all-in-one-seo-pack/all_in_one_seo_pack.php')) {
    return 'aioseo';
  }
  if (plugins.includes('wp-seopress/seopress.php')) {
    return 'seopress';
  }

  return plugins.some((plugin) => plugin.includes('seo')) ? 'unknown' : 'none';
}

function normalizeCapabilities(
  response: WordPressCapabilitiesResponse
): WordPressCapabilitySummary {
  const raw = response.capabilities ?? {};

  return {
    read: true,
    write: Object.values(raw).some(Boolean),
    themeFiles: Boolean(raw.optionUpdate),
    mediaUpload: Boolean(raw.mediaAltUpdate),
    pageUpdate: Boolean(raw.headSnippetInjection || raw.jsonLdInjection || raw.metaTagInjection),
    rollback: Boolean(raw.rollback || raw.snippetDelete),
    raw,
  };
}

function buildSnapshot(
  status: WordPressStatusResponse,
  capabilities: WordPressCapabilitiesResponse,
  pull: WordPressPullResponse
): WordPressSiteSnapshot {
  const themeSlug = normalizeThemeSlug(pull.theme);

  return {
    siteUrl: pull.siteUrl,
    inspectedAt: new Date().toISOString(),
    wpVersion: pull.wpVersion || status.version,
    pluginVersion: pull.pluginVersion || status.pluginVersion,
    phpVersion: pull.phpVersion,
    mysqlVersion: pull.mysqlVersion,
    activeTheme: {
      name: pull.theme,
      stylesheet: themeSlug,
      template: themeSlug,
      hasChildTheme: null,
    },
    builder: detectBuilder(pull.theme, pull.plugins),
    seoPlugin: detectSeoPlugin(pull.plugins),
    activePlugins: pull.plugins,
    capabilities: normalizeCapabilities(capabilities),
    issues: [],
  };
}

async function getAppUserId(db: ReturnType<typeof getDb>): Promise<number | null> {
  try {
    const appUser = await getUser();
    if (appUser?.id) {
      return appUser.id;
    }
  } catch {
    // ignore
  }

  const clerkUser = await currentUser().catch(() => null);
  if (!clerkUser) {
    return null;
  }

  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUser.id))
    .limit(1);

  return row?.id ?? null;
}

function toInspectError(error: unknown): InspectErrorPayload {
  const maybeError = error as {
    code?: string;
    message?: string;
    details?: string;
    toJSON?: () => InspectErrorPayload;
  };

  if (
    maybeError.code &&
    WordPressErrorCode[maybeError.code as keyof typeof WordPressErrorCode] &&
    typeof maybeError.toJSON === 'function'
  ) {
    return maybeError.toJSON();
  }

  if (maybeError.message?.includes('POSTGRES_URL is not set')) {
    return {
      code: 'CONFIGURATION_ERROR',
      title: 'Server Configuration Error',
      message: 'Database connection is not configured.',
      action: 'Add POSTGRES_URL to the deployment environment and redeploy.',
      details: maybeError.message,
    };
  }

  return {
    code: 'INSPECT_FAILED',
    title: 'Inspection Failed',
    message: 'Could not inspect this WordPress site.',
    action: 'Retry the inspection or reconnect the site if the problem persists.',
    details: maybeError.message,
  };
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const userId = await getAppUserId(db);

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'SIGN_IN_REQUIRED' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as InspectRequestBody;
    const siteId = body.siteId?.trim();

    if (!siteId) {
      return NextResponse.json({ ok: false, error: 'SITE_ID_REQUIRED' }, { status: 400 });
    }

    const [site] = await db
      .select({
        id: sites.id,
        userId: sites.userId,
        siteUrl: sites.siteUrl,
        tokenHash: sites.tokenHash,
        wpVersion: sites.wpVersion,
        pluginVersion: sites.pluginVersion,
        wordpressConnection: sites.wordpressConnection,
      })
      .from(sites)
      .where(eq(sites.id, siteId))
      .limit(1);

    if (!site || site.userId !== userId) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    const connection = (site.wordpressConnection ?? null) as Partial<WordPressConnection> | null;
    const tokenHash = site.tokenHash || connection?.tokenHash;

    if (!tokenHash) {
      return NextResponse.json(
        { ok: false, error: 'WORDPRESS_NOT_CONNECTED' },
        { status: 400 }
      );
    }

    const client = createWordPressClient({
      siteUrl: site.siteUrl,
      tokenHash,
      timeout: 10000,
    });

    const [status, capabilities, pull] = await Promise.all([
      client.getStatus(),
      client.getCapabilities(),
      client.pull(),
    ]);

    const snapshot = buildSnapshot(status, capabilities, pull);

    await db
      .update(sites)
      .set({
        connectionStatus: 'connected',
        isConnected: true,
        lastConnectedAt: new Date(),
        connectionError: null,
        wpVersion: snapshot.wpVersion ?? site.wpVersion,
        pluginVersion: snapshot.pluginVersion ?? site.pluginVersion,
        updatedAt: new Date(),
      })
      .where(eq(sites.id, site.id));

    return NextResponse.json({
      ok: true,
      siteId: site.id,
      snapshot,
    });
  } catch (error) {
    const inspectError = toInspectError(error);
    const status = inspectError.code === 'CONFIGURATION_ERROR' ? 503 : 500;

    return NextResponse.json(
      {
        ok: false,
        error: inspectError,
      },
      { status }
    );
  }
}
