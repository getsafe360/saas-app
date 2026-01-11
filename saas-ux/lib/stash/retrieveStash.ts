// lib/stash/retrieveStash.ts
// Server and client utilities to retrieve stashed test results

import type { StashedTestResult } from "./types";

/**
 * Retrieve stashed test results from Vercel Blob
 * Can be called from server or client (uses public URL)
 */
export async function retrieveStash(
  stashUrl: string
): Promise<StashedTestResult | null> {
  try {
    const response = await fetch(stashUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Failed to retrieve stash:", response.status);
      return null;
    }

    const data = await response.json();

    // Validate basic structure
    if (!data.url || !data.timestamp) {
      console.error("Invalid stash data structure");
      return null;
    }

    return data as StashedTestResult;
  } catch (error) {
    console.error("Error retrieving stash:", error);
    return null;
  }
}

/**
 * Parse stash URL from query parameter
 * Handles both short key (stashKey) and full URL (stashUrl)
 */
export function parseStashFromUrl(
  searchParams: URLSearchParams
): string | null {
  // Try full URL first
  const stashUrl = searchParams.get("stashUrl") || searchParams.get("u");
  if (stashUrl) {
    return decodeURIComponent(stashUrl);
  }

  // Try key (legacy)
  const stashKey = searchParams.get("stashKey") || searchParams.get("k");
  if (stashKey) {
    // Construct full Blob URL
    const blobUrl = `https://${process.env.NEXT_PUBLIC_BLOB_STORE_ID}.public.blob.vercel-storage.com/${stashKey}`;
    return blobUrl;
  }

  return null;
}

/**
 * Validate stash data structure
 */
export function isValidStash(data: any): data is StashedTestResult {
  return (
    data &&
    typeof data === "object" &&
    typeof data.url === "string" &&
    typeof data.timestamp === "string" &&
    Array.isArray(data.findings)
  );
}
