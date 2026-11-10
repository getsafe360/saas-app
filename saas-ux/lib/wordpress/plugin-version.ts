// lib/wordpress/plugin-version.ts
//
// The connector version this release ships (public/wp-plugin). Kept free of
// server imports so browser components can compare against it.
// plugin-version.test.ts checks it against the plugin file's header.

export const CURRENT_PLUGIN_VERSION = '1.10.0';

/** True when `installed` is older than `latest` (plain x.y.z versions). */
export function isPluginOutdated(installed: string, latest: string = CURRENT_PLUGIN_VERSION): boolean {
  const parse = (v: string) => v.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(installed);
  const b = parse(latest);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
}
