// lib/ai/usage.ts
// Token totals from an AI SDK `usage` object. @ai-sdk/anthropic@3 reports the
// V3 shape (nested `inputTokens.total` / `outputTokens.total`, no `totalTokens`)
// while ai@5 beta passes it through untouched; V2 providers report flat numbers.

function count(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    const total = (value as { total?: unknown }).total;
    if (typeof total === "number" && Number.isFinite(total)) return total;
  }
  return undefined;
}

/** Tokens actually used (input + output), or undefined when the provider reported none. */
export function totalTokensOf(usage: unknown): number | undefined {
  if (!usage || typeof usage !== "object") return undefined;
  const u = usage as Record<string, unknown>;
  const total = count(u.totalTokens);
  if (total !== undefined) return total;
  const input = count(u.inputTokens);
  const output = count(u.outputTokens);
  if (input === undefined && output === undefined) return undefined;
  return (input ?? 0) + (output ?? 0);
}
