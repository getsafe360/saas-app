export interface TestServiceConfig {
  baseUrl: string | null;
  apiKey: string | undefined;
  sourceVar: string | null;
}

const BASE_URL_CANDIDATES = [
  'HOMEPAGE_TEST_SERVICE_BASE_URL',
  'TEST_SERVICE_BASE_URL',
  'CREW_SERVICE_BASE_URL',
] as const;

const API_KEY_CANDIDATES = [
  'HOMEPAGE_TEST_SERVICE_API_KEY',
  'TEST_SERVICE_API_KEY',
  'CREW_SERVICE_API_KEY',
] as const;

export function getTestServiceConfig(env: NodeJS.ProcessEnv = process.env): TestServiceConfig {
  for (const key of BASE_URL_CANDIDATES) {
    const raw = env[key];
    if (raw && raw.trim()) {
      return {
        baseUrl: raw.trim().replace(/\/$/, ''),
        apiKey: resolveApiKey(env),
        sourceVar: key,
      };
    }
  }

  return {
    baseUrl: null,
    apiKey: resolveApiKey(env),
    sourceVar: null,
  };
}

export function isValidHttpBaseUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

function resolveApiKey(env: NodeJS.ProcessEnv): string | undefined {
  for (const key of API_KEY_CANDIDATES) {
    const raw = env[key];
    if (raw && raw.trim()) {
      return raw.trim();
    }
  }

  return undefined;
}
