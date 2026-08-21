// lib/logger.ts
//
// Minimal structured logger. Emits one JSON object per line so Vercel's log
// drain (and later Sentry, Datadog, or whatever we land on) can parse it
// without a custom grok pattern. Deliberately dependency-free: adding an
// error-tracking SDK is a post-launch decision, but losing the context of a
// failure is not something we can recover after the fact.
//
// Usage:
//   const log = logger('scan/status');
//   log.info('job started', { jobId, siteId });
//   log.error('analyzer failed', err, { jobId });

type Level = 'debug' | 'info' | 'warn' | 'error';

type Fields = Record<string, unknown>;

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): number {
  const configured = (process.env.LOG_LEVEL ?? '').toLowerCase() as Level;
  if (configured in LEVEL_ORDER) return LEVEL_ORDER[configured];
  return process.env.NODE_ENV === 'production' ? LEVEL_ORDER.info : LEVEL_ORDER.debug;
}

/** Turn an unknown thrown value into something serialisable. */
export function serializeError(err: unknown): Fields {
  if (err instanceof Error) {
    return {
      errorName: err.name,
      errorMessage: err.message,
      // Stacks are long; keep the top frames, which is where the signal is.
      errorStack: err.stack?.split('\n').slice(0, 8).join('\n'),
      ...(typeof (err as { code?: unknown }).code !== 'undefined'
        ? { errorCode: (err as { code?: unknown }).code }
        : {}),
    };
  }
  return { errorMessage: typeof err === 'string' ? err : JSON.stringify(err) };
}

function emit(scope: string, level: Level, message: string, fields?: Fields) {
  if (LEVEL_ORDER[level] < minLevel()) return;

  const line = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(fields ?? {}),
  };

  // console.error for warn/error so they land on stderr and get flagged by
  // the platform; console.log otherwise.
  const sink = level === 'error' || level === 'warn' ? console.error : console.log;
  try {
    sink(JSON.stringify(line));
  } catch {
    // Circular field somewhere — never let logging throw into a request path.
    sink(`{"ts":"${line.ts}","level":"${level}","scope":"${scope}","message":${JSON.stringify(message)}}`);
  }
}

export type Logger = {
  debug(message: string, fields?: Fields): void;
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, err?: unknown, fields?: Fields): void;
  child(childScope: string): Logger;
};

export function logger(scope: string): Logger {
  return {
    debug: (message, fields) => emit(scope, 'debug', message, fields),
    info: (message, fields) => emit(scope, 'info', message, fields),
    warn: (message, fields) => emit(scope, 'warn', message, fields),
    error: (message, err, fields) =>
      emit(scope, 'error', message, { ...(err !== undefined ? serializeError(err) : {}), ...(fields ?? {}) }),
    child: (childScope) => logger(`${scope}:${childScope}`),
  };
}

export default logger;
