// lib/wordpress/connection-status.ts
//
// One reading of a site row's connection state, shared by the cockpit, the
// WordPress page and the sidebar.

export type SiteConnectionStatus = 'connected' | 'reconnecting' | 'error' | 'pending' | 'disconnected';

interface ConnectionColumns {
  connectionStatus?: string | null;
  isConnected?: boolean | null;
  status?: string | null;
}

export function siteConnectionStatus(site: ConnectionColumns | null | undefined): SiteConnectionStatus {
  if (!site) return 'disconnected';
  // connectionStatus is authoritative once any write path has set it.
  const cs = site.connectionStatus;
  if (cs === 'connected' || cs === 'reconnecting' || cs === 'error' || cs === 'pending' || cs === 'disconnected') {
    return cs;
  }
  // Rows from before the column existed: fall back to the older flags.
  if (site.isConnected) return 'connected';
  if (site.status === 'connected') return 'connected';
  return 'disconnected';
}

/** The WordPress page of a site; `#connection-card` jumps to the connect steps. */
export function wordpressPagePath(siteId: string, connect = false): string {
  return `/dashboard/sites/${siteId}/wordpress-agent${connect ? '#connection-card' : ''}`;
}
