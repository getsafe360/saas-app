// lib/wordpress/logger.ts
// Connection logging utility for WordPress sites

import { getDrizzle } from '@/lib/db/postgres';
import { connectionLogs } from '@/lib/db/schema';

export type ConnectionEventStatus =
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error'
  | 'pairing_started'
  | 'pairing_completed'
  | 'test_success'
  | 'test_failed';

interface LogConnectionEventParams {
  siteId: string;
  status: ConnectionEventStatus;
  success: boolean;
  errorMessage?: string;
}

/**
 * Log a WordPress connection event to the database
 *
 * This creates an audit trail for all connection-related activities:
 * - Initial pairing
 * - Reconnection attempts
 * - Disconnections
 * - Connection tests
 * - Errors
 *
 * @param params - Connection event details
 * @returns Promise<void>
 */
export async function logConnectionEvent({
  siteId,
  status,
  success,
  errorMessage,
}: LogConnectionEventParams): Promise<void> {
  try {
    const db = getDrizzle();
    await db.insert(connectionLogs).values({
      siteId,
      status,
      success,
      errorMessage,
      attemptedAt: new Date(),
    });
  } catch (error) {
    console.error('[WordPress Logger] Failed to write connection log:', error);
    // Don't throw - logging failures shouldn't break the connection flow
  }
}

/**
 * Log a successful connection
 */
export async function logConnectionSuccess(siteId: string): Promise<void> {
  await logConnectionEvent({
    siteId,
    status: 'connected',
    success: true,
  });
}

/**
 * Log a connection error
 */
export async function logConnectionError(
  siteId: string,
  errorMessage: string,
  status: ConnectionEventStatus = 'error'
): Promise<void> {
  await logConnectionEvent({
    siteId,
    status,
    success: false,
    errorMessage,
  });
}

/**
 * Log a disconnection
 */
export async function logDisconnection(siteId: string): Promise<void> {
  await logConnectionEvent({
    siteId,
    status: 'disconnected',
    success: true,
  });
}

/**
 * Log pairing start
 */
export async function logPairingStart(siteId: string): Promise<void> {
  await logConnectionEvent({
    siteId,
    status: 'pairing_started',
    success: true,
  });
}

/**
 * Log pairing completion
 */
export async function logPairingComplete(siteId: string): Promise<void> {
  await logConnectionEvent({
    siteId,
    status: 'pairing_completed',
    success: true,
  });
}
