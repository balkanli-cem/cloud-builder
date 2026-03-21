import type { NextFunction, Request, Response } from 'express';
import type { Options } from 'express-rate-limit';

type RequestWithRateLimit = Request & {
  rateLimit?: { resetTime?: Date };
};

/**
 * Custom express-rate-limit handler: JSON body with retryAfterSeconds (seconds until reset).
 * The library still sets Retry-After before this runs when standardHeaders is enabled.
 */
export function rateLimit429JsonHandler(options: { message: string }) {
  return (req: Request, res: Response, _next: NextFunction, opts: Options): void => {
    const rl = (req as RequestWithRateLimit).rateLimit;
    const windowMs = opts.windowMs;
    const resetSeconds = rl?.resetTime
      ? Math.max(0, Math.ceil((rl.resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(windowMs / 1000);
    res.status(429).json({
      error: options.message,
      retryAfterSeconds: resetSeconds,
    });
  };
}
