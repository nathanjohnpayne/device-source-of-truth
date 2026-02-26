import { logger as firebaseLogger } from 'firebase-functions';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestLogger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
  child: (context: Record<string, unknown>) => RequestLogger;
  elapsedMs: () => number;
}

const LOG_PREFIX = 'DST';

function formatContext(ctx: Record<string, unknown>): Record<string, unknown> {
  return { service: LOG_PREFIX, ...ctx };
}

export const log = {
  info: (message: string, data?: Record<string, unknown>) =>
    firebaseLogger.info(message, formatContext(data ?? {})),
  warn: (message: string, data?: Record<string, unknown>) =>
    firebaseLogger.warn(message, formatContext(data ?? {})),
  error: (message: string, data?: Record<string, unknown>) =>
    firebaseLogger.error(message, formatContext(data ?? {})),
  debug: (message: string, data?: Record<string, unknown>) =>
    firebaseLogger.debug(message, formatContext(data ?? {})),
};

export function createRequestLogger(req: Request): RequestLogger {
  const requestId = randomUUID().slice(0, 8);
  const startTime = Date.now();
  const baseContext: Record<string, unknown> = {
    requestId,
    method: req.method,
    path: req.path,
  };

  function makeLogger(extraContext: Record<string, unknown> = {}): RequestLogger {
    const ctx = { ...baseContext, ...extraContext };

    return {
      info: (message, data) =>
        firebaseLogger.info(message, formatContext({ ...ctx, ...data })),
      warn: (message, data) =>
        firebaseLogger.warn(message, formatContext({ ...ctx, ...data })),
      error: (message, data) =>
        firebaseLogger.error(message, formatContext({ ...ctx, ...data })),
      debug: (message, data) =>
        firebaseLogger.debug(message, formatContext({ ...ctx, ...data })),
      child: (childContext) => makeLogger({ ...ctx, ...childContext }),
      elapsedMs: () => Date.now() - startTime,
    };
  }

  return makeLogger();
}

declare global {
  namespace Express {
    interface Request {
      log?: RequestLogger;
      requestId?: string;
    }
  }
}

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const rlog = createRequestLogger(req);
  req.log = rlog;
  req.requestId = (rlog as unknown as { elapsedMs: () => number }).elapsedMs
    ? randomUUID().slice(0, 8)
    : undefined;

  const userAgent = req.headers['user-agent'] ?? 'unknown';
  const contentLength = req.headers['content-length'] ?? '0';

  rlog.info('Request received', {
    userAgent,
    contentLength,
    query: Object.keys(req.query).length > 0 ? req.query as Record<string, unknown> : undefined,
    ip: req.ip,
  });

  const originalJson = res.json.bind(res);
  res.json = function (body?: unknown) {
    const elapsed = rlog.elapsedMs();
    const statusCode = res.statusCode;

    if (statusCode >= 500) {
      rlog.error('Request completed with server error', {
        statusCode,
        elapsedMs: elapsed,
        error: (body as Record<string, unknown>)?.error,
        detail: (body as Record<string, unknown>)?.detail,
      });
    } else if (statusCode >= 400) {
      rlog.warn('Request completed with client error', {
        statusCode,
        elapsedMs: elapsed,
        error: (body as Record<string, unknown>)?.error,
      });
    } else {
      rlog.info('Request completed', {
        statusCode,
        elapsedMs: elapsed,
      });
    }

    return originalJson(body);
  };

  next();
}

export function formatError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack,
    };
  }
  return { errorMessage: String(err) };
}
