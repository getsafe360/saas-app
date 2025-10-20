// lib/net/isPublicUrl.ts (basic SSRF guard)
export function isPublicUrl(u: string) {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return false;
    // Block obvious localhost patterns
    if (/(^|\.)(localhost|local|internal|lan)$/i.test(url.hostname)) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
      // naive private-IP block
      const [a,b,c] = url.hostname.split(".").map(Number);
      if (a === 10) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 127) return false;
    }
    return true;
  } catch {
    return false;
  }
}
