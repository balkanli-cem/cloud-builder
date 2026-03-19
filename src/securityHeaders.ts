import helmet from 'helmet';
import type { RequestHandler } from 'express';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Helmet middleware: CSP, X-Frame-Options (via frame-ancestors), X-Content-Type-Options,
 * Referrer-Policy, and other hardening. Tuned for same-origin SPA + /api/* JSON.
 *
 * - style-src 'unsafe-inline': React components use inline style={{ ... }}.
 * - connect-src 'self': fetch() to same host for API.
 * - frame-ancestors 'none': clickjacking protection (stronger than X-Frame-Options alone).
 * - HSTS only in production (Azure App Service is HTTPS).
 */
export function securityHeadersMiddleware(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        ...(isProd ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    // Avoid COEP breaking edge cases; not required for this app
    crossOriginEmbedderPolicy: false,
    // HSTS: tell browsers to use HTTPS only (Azure Web App is HTTPS in prod)
    hsts: isProd
      ? { maxAge: 15552000, includeSubDomains: true, preload: false }
      : false,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    xDnsPrefetchControl: { allow: false },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  });
}
