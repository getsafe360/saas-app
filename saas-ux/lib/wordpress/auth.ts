// lib/wordpress/auth.ts
// WordPress authentication and token management

import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

/**
 * Generate a secure random site token
 *
 * Uses crypto.randomBytes for cryptographically secure randomness
 * Returns base64url-encoded token (safe for URLs and headers)
 *
 * @param bytes - Number of random bytes (default: 32 = 256 bits)
 * @returns Base64url-encoded token string
 */
export function generateSiteToken(bytes: number = 32): string {
  return randomBytes(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Hash a site token using SHA-256
 *
 * Tokens are stored as hashes in the database for security.
 * SaaS platform sends the token hash as X-API-Key.
 * WordPress plugin hashes its stored plain token and compares it.
 *
 * @param token - Plain text token
 * @returns Hex-encoded SHA-256 hash
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against its hash
 *
 * Uses timing-safe comparison to prevent timing attacks
 *
 * @param token - Plain text token to verify
 * @param hash - Stored hash to compare against
 * @returns True if token matches hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);

  // Convert to buffers for timing-safe comparison
  const tokenHashBuffer = Buffer.from(tokenHash);
  const hashBuffer = Buffer.from(hash);

  // timingSafeEqual throws if lengths differ, so check first
  if (tokenHashBuffer.length !== hashBuffer.length) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(tokenHashBuffer, hashBuffer);
}

/**
 * Generate a 6-digit pairing code
 *
 * Uses crypto.randomInt for cryptographically secure randomness.
 * Format: 000000 - 999999
 *
 * @returns 6-digit code as string
 */
export function generatePairingCode(): string {
  const code = randomInt(0, 1000000);
  return code.toString().padStart(6, '0');
}

/**
 * Validate pairing code format
 *
 * @param code - Code to validate
 * @returns True if code is exactly 6 digits
 */
export function isValidPairingCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Structure for WordPress connection credentials stored in JSONB
 */
export interface WordPressConnection {
  authMethod: 'pairing_token';
  tokenHash: string;
  capabilities: string[];
  lastVerified: string;
  pluginVersion: string;
  wpVersion: string;
  siteUrl: string;
}

/**
 * Create WordPress connection metadata object
 *
 * This is stored in the sites.wordpressConnection JSONB field
 *
 * @param params - Connection parameters
 * @returns WordPressConnection object
 */
export function createWordPressConnection(params: {
  tokenHash: string;
  pluginVersion: string;
  wpVersion: string;
  siteUrl: string;
}): WordPressConnection {
  return {
    authMethod: 'pairing_token',
    tokenHash: params.tokenHash,
    capabilities: ['read', 'write'], // Can be expanded in future
    lastVerified: new Date().toISOString(),
    pluginVersion: params.pluginVersion,
    wpVersion: params.wpVersion,
    siteUrl: params.siteUrl,
  };
}
