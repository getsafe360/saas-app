export function withSecureSslMode(connectionString: string): string {
  if (!connectionString) return connectionString;
  if (/sslmode=/.test(connectionString)) return connectionString;

  const separator = connectionString.includes('?') ? '&' : '?';
  return `${connectionString}${separator}sslmode=verify-full`;
}
