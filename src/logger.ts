import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';
import type { Request, Response } from 'express';

const requestContext = new AsyncLocalStorage<{
  requestId: string;
  userId?: number;
}>();

/**
 * Base logger: JSON to stdout, suitable for App Insights / Log Analytics.
 * Use getLogger() in request-scoped code to get a child with requestId (and userId when set).
 */
export const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({}),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: 'cloud-builder' },
});

export type Logger = pino.Logger;

/**
 * Returns a request-scoped child logger with requestId and userId (when set).
 * Use this in route handlers and any code that runs during a request (e.g. db client).
 * When called outside a request (e.g. startup), returns the base logger.
 */
export function getLogger(): pino.Logger {
  const store = requestContext.getStore();
  if (!store) return baseLogger;
  const bindings: { requestId: string; userId?: number } = { requestId: store.requestId };
  if (store.userId != null) bindings.userId = store.userId;
  return baseLogger.child(bindings);
}

/**
 * Run the rest of the request in a context that getLogger() can use.
 * Store is mutable so setRequestUserId() can add userId after auth.
 */
export function runWithRequestContext<T>(requestId: string, fn: () => T): T {
  const store = { requestId, userId: undefined as number | undefined };
  return requestContext.run(store, fn);
}

/**
 * Set userId on the current request context (call after auth middleware).
 */
export function setRequestUserId(userId: number): void {
  const store = requestContext.getStore();
  if (store) store.userId = userId;
}

/**
 * Middleware: assigns req.id and runs the request in AsyncLocalStorage so getLogger() gets requestId.
 * Must be mounted early (before routes that use getLogger()).
 */
export function requestIdMiddleware(
  req: Request & { id?: string },
  _res: Response,
  next: () => void
): void {
  const id = req.headers['x-request-id'] as string | undefined ?? crypto.randomUUID();
  req.id = id;
  runWithRequestContext(id, next);
}
