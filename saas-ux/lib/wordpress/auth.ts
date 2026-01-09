// lib/wordpress/auth.ts
// WordPress authentication and token management

import { createHash, randomBytes } from 'crypto';

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
 * WordPress plugin sends the plain token, we hash it for comparison.
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
 * @param token - Plain text token to verify
 * @param hash - Stored hash to compare against
 * @returns True if token matches hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  return tokenHash === hash;
}

/**
 * Generate a 6-digit pairing code
 *
 * Generates a random 6-digit code for the initial pairing flow.
 * Format: 000000 - 999999
 *
 * @returns 6-digit code as string
 */
export function generatePairingCode(): string {
  const code = Math.floor(Math.random() * 1000000);
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
