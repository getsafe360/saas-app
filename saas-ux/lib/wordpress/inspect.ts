import { getDb } from '@/lib/db/drizzle';
import { wordpressSiteSnapshots } from '@/lib/db/schema';
import type {
  WordPressBuilder,
  WordPressCapabilitySummary,
  WordPressSeoPlugin,
  WordPressSiteSnapshot,
} from '@/lib/wordpress/types';
import type {
  WordPressCapabilitiesResponse,
  WordPressPullResponse,
  WordPressStatusResponse,
} from '@/lib/wordpress/client';

export function normalizeThemeSlug(themeName: string): string {
  return themeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

export function detectBuilder(themeName: string, activePlugins: string[]): WordPressBuilder {
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

export function detectSeoPlugin(activePlugins: string[]): WordPressSeoPlugin {
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

export function normalizeCapabilities(
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

export function buildSnapshot(
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

function formatPluginName(pluginPath: string): string {
  const fileName = pluginPath.split('/').pop() ?? pluginPath;
  const stem = fileName.replace(/\.php$/i, '');
  return stem
    .split(/[-_]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

export async function fetchLatestWordPressCoreRelease(): Promise<{
  version: string | null;
  releaseDate: string | null;
}> {
  try {
    const response = await fetch('https://api.wordpress.org/core/version-check/1.7/', {
      headers: { Accept: 'application/json' },
      cache: 'force-cache',
      next: { revalidate: 21600 },
    });

    if (!response.ok) {
      return { version: null, releaseDate: null };
    }

    const data = await response.json() as {
      offers?: Array<{
        version?: string;
        current?: string;
        response?: string;
        date?: string;
      }>;
    };

    const stable = data.offers?.find((offer) => offer.response === 'latest') ?? data.offers?.[0];
    return {
      version: stable?.current ?? stable?.version ?? null,
      releaseDate: stable?.date ?? null,
    };
  } catch {
    return { version: null, releaseDate: null };
  }
}

export function buildWordPressTelemetry(snapshot: WordPressSiteSnapshot, latestVersion?: string | null, latestReleaseDate?: string | null) {
  const pluginList = snapshot.activePlugins.map((pluginPath) => ({
    slug: pluginPath.split('/')[0] ?? pluginPath,
    name: formatPluginName(pluginPath),
    version: 'Unknown',
    latest: 'Unknown',
    outdated: false,
    vulnerable: false,
    lastUpdated: '',
  }));

  return {
    snapshot,
    latestVersion: latestVersion ?? snapshot.wpVersion ?? null,
    latestReleaseDate: latestReleaseDate ?? null,
    plugins: {
      total: pluginList.length,
      active: pluginList.length,
      outdated: 0,
      vulnerable: 0,
      list: pluginList,
    },
    theme: {
      active: snapshot.activeTheme.name ?? snapshot.activeTheme.stylesheet,
      childTheme: snapshot.activeTheme.hasChildTheme ?? false,
    },
    connection: {
      authMethod: 'plugin-rest',
      capabilities: snapshot.capabilities.raw,
    },
  };
}

export async function persistWordPressSnapshot(
  db: ReturnType<typeof getDb>,
  siteId: string,
  snapshot: WordPressSiteSnapshot,
  source: string = 'connector'
) {
  await db.insert(wordpressSiteSnapshots).values({
    siteId,
    source,
    builder: snapshot.builder,
    wordpressVersion: snapshot.wpVersion ?? null,
    pluginVersion: snapshot.pluginVersion ?? null,
    activeTheme: snapshot.activeTheme.name ?? snapshot.activeTheme.stylesheet,
    pluginCount: snapshot.activePlugins.length,
    snapshot: snapshot as unknown as Record<string, unknown>,
  });
}
