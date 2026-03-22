import type { Request } from 'express';

/**
 * Best-effort client IP (respects trust proxy + X-Forwarded-For).
 */
export function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const ip = req.ip || req.socket?.remoteAddress;
  if (typeof ip === 'string' && ip) return ip.slice(0, 45);
  return null;
}

export function getUserAgent(req: Request): string | null {
  const ua = req.headers['user-agent'];
  if (typeof ua === 'string' && ua) return ua.slice(0, 512);
  return null;
}
