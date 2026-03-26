import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { securityHeadersMiddleware } from './securityHeaders';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import archiver from 'archiver';
import { getLogger, baseLogger, requestIdMiddleware, setRequestUserId } from './logger';
import { generateBicep } from './generators/bicep/index';
import { generateTerraform } from './generators/terraform/index';
import { validateBicep, validateTerraform } from './validation-iac';
import { buildDefaultNetwork } from './core/network/defaults';
import { SERVICE_CATALOG } from './core/services/catalog';
import { GENERATOR_CHANGELOG } from './core/generator-changelog';
import {
  saveGeneration,
  getGenerationsByUserId,
  getGenerationByIdAndUserId,
  deleteGenerationByIdAndUserId,
  checkDatabase,
  findUserByEmail,
  recordLoginEvent,
  touchSession,
  revokeSession,
  getSessionStats,
  getRecentLoginEvents,
  listClientsByUserId,
  createClient,
  findClientByIdAndUserId,
} from './db/client';
import { register, login, verifyToken, requestPasswordReset, resetPassword } from './auth';
import { getClientIp, getUserAgent } from './lib/clientIp';
import {
  handleValidationErrors,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  generateValidation,
  generationIdParamValidation,
  downloadFormatQueryValidation,
  validateGenerateConfigBody,
  clientCreateValidation,
} from './validation';
import type { ProjectConfig } from './types/index';
import { rateLimit429JsonHandler } from './rateLimitHandler';

const app = express();
app.set('trust proxy', 1); // so req.ip is the client IP when behind Azure/nginx
app.use(securityHeadersMiddleware());
app.use(
  cors({
    exposedHeaders: ['Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'RateLimit-Policy'],
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware);

const PORT = process.env.PORT ?? 3000;
const WEB_DIR = path.join(__dirname, '..', 'web-dist');

// ─── Rate limiting ───────────────────────────────────────────────────────────
// Limits how many requests a client (by IP) can make in a time window. Prevents
// brute-force (login/register) and abuse (generate). Each limiter counts per IP.
// When the limit is exceeded, the client gets HTTP 429 and must wait for the window to reset.

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** How long without API activity before a session stops counting as "active" (env override). */
const SESSION_IDLE_MINUTES = Math.max(
  1,
  Math.min(24 * 60, parseInt(process.env.SESSION_IDLE_MINUTES ?? '15', 10) || 15),
);

export type AuthedUser = { email: string; userId: number; jti?: string };

/** Auth: strict limit to slow down brute-force and credential stuffing. */
const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 10,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true, // RateLimit-* + Retry-After when limited
  legacyHeaders: false,
  handler: rateLimit429JsonHandler({
    message: 'Too many attempts. Please try again later.',
  }),
});

/** Generate: cap heavy requests per IP so one client cannot overload the server. */
const generateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 30,
  message: { error: 'Too many generations. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimit429JsonHandler({
    message: 'Too many generations. Please try again later.',
  }),
});

async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }
  if (payload.jti && process.env.AZURE_SQL_CONNECTION_STRING) {
    const sessionOk = await touchSession(payload.jti);
    if (!sessionOk) {
      res.status(401).json({ error: 'Session expired or revoked. Sign in again.' });
      return;
    }
  }
  (req as express.Request & { user: AuthedUser }).user = payload;
  setRequestUserId(payload.userId);
  next();
}

function adminApiKeyMiddleware(_req: express.Request, res: express.Response, next: express.NextFunction): void {
  const key = process.env.ADMIN_API_KEY;
  if (!key || key.length < 8) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }
  const provided = _req.headers['x-admin-key'];
  if (typeof provided !== 'string' || provided !== key) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  next();
}

// Serve built frontend (after npm run build:web)
app.use(express.static(WEB_DIR));

// Health: liveness (app is up) and readiness (app + optional DB)
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/health/ready', async (_req, res) => {
  const db = await checkDatabase();
  if (db.configured && !db.ok) {
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
    return;
  }
  res.status(200).json({ status: 'ok', database: db.configured ? 'connected' : 'not_configured' });
});

// Auth: register (hashed password stored in DB) — rate limited, validated
app.post('/api/register', authLimiter, ...registerValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  const { email, password, displayName } = req.body as { email: string; password: string; displayName?: string };
  const result = await register(email, password, displayName);
  if (!result.ok) {
    res.status(result.error.includes('already exists') ? 409 : 400).json({ error: result.error });
    return;
  }
  res.status(201).json({ ok: true, userId: result.userId });
});

// Auth: login (returns JWT; password checked against hash) — rate limited, validated
app.post('/api/login', authLimiter, ...loginValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const trimmed = email.trim().toLowerCase();
  const ip = getClientIp(req);
  const ua = getUserAgent(req);
  const result = await login(email, password, { ip, userAgent: ua });
  if (!result.ok) {
    if (result.error === 'Invalid email or password.') {
      const u = await findUserByEmail(trimmed);
      await recordLoginEvent(u?.Id ?? null, trimmed, false, ip, ua);
      res.status(401).json({ error: result.error });
      return;
    }
    res.status(503).json({ error: result.error });
    return;
  }
  res.json({ token: result.token, email: result.email });
});

// Revoke current DB-backed session (optional; client should call on sign-out)
app.post('/api/logout', authMiddleware, async (req: express.Request, res: express.Response) => {
  const { user } = req as express.Request & { user: AuthedUser };
  if (user.jti && process.env.AZURE_SQL_CONNECTION_STRING) {
    await revokeSession(user.jti, user.userId);
  }
  res.status(200).json({ ok: true });
});

// Admin: concurrent users + recent login events (set ADMIN_API_KEY; send X-Admin-Key header)
app.get('/api/admin/login-stats', adminApiKeyMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const idleParam = parseInt(String(req.query.idleMinutes ?? ''), 10);
    const idleMinutes = Number.isFinite(idleParam) && idleParam > 0 ? Math.min(idleParam, 24 * 60) : SESSION_IDLE_MINUTES;
    const stats = await getSessionStats(idleMinutes);
    if (!stats) {
      res.status(503).json({ error: 'Database not available.' });
      return;
    }
    const includeEvents = req.query.include === 'events';
    const limitRaw = parseInt(String(req.query.limit ?? '50'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const recentEvents = includeEvents ? await getRecentLoginEvents(limit) : undefined;
    res.json({
      activeUsers: stats.activeUsers,
      activeSessions: stats.activeSessions,
      idleWindowMinutes: idleMinutes,
      ...(recentEvents !== undefined && {
        recentEvents: recentEvents.map((e) => ({
          id: e.Id,
          userId: e.UserId,
          email: e.Email,
          success: e.Success,
          loginAt: e.LoginAt,
          ipAddress: e.IpAddress,
          userAgent: e.UserAgent,
        })),
      }),
    });
  } catch (err) {
    getLogger().error({ err }, 'GET /api/admin/login-stats failed');
    res.status(500).json({ error: 'Failed to load stats.' });
  }
});

// Auth: forgot password — always 200 with generic message (no user enumeration); rate limited
app.post('/api/forgot-password', authLimiter, ...forgotPasswordValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  const { email } = req.body as { email: string };
  const result = await requestPasswordReset(email);
  if (result.ok) {
    if (process.env.NODE_ENV !== 'production') {
      getLogger().info({ resetLink: result.resetLink }, 'forgot-password: reset link (do not log in production)');
    }
    // TODO: send result.resetLink by email (e.g. SendGrid, Nodemailer) when configured
  }
  res.status(200).json({
    message: 'If an account exists with that email, we sent a password reset link. Check your inbox and spam folder.',
  });
});

// Auth: reset password with token from email link — rate limited
app.post('/api/reset-password', authLimiter, ...resetPasswordValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  const { token, newPassword } = req.body as { token: string; newPassword: string };
  const result = await resetPassword(token, newPassword);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(200).json({ message: 'Password updated. You can sign in with your new password.' });
});

// Auth: current user (requires valid JWT)
app.get('/api/me', authMiddleware, (req, res) => {
  const { user } = req as express.Request & { user: AuthedUser };
  res.json({ email: user.email });
});

// List generations for the current user (for "My generations" dashboard)
app.get('/api/generations', authMiddleware, async (req, res) => {
  const { user } = req as express.Request & { user: AuthedUser };
  try {
    const list = await getGenerationsByUserId(user.userId);
    const generations = list.map((g) => ({
      id: g.Id,
      projectName: g.ProjectName,
      resourceGroupName: g.ResourceGroupName,
      region: g.Region,
      format: g.Format,
      createdAt: g.CreatedAt,
      validationStatus: g.ValidationStatus ?? null,
      validationMessage: g.ValidationMessage ?? null,
    }));
    res.json({ generations });
  } catch (err) {
    getLogger().error({ err }, 'GET /api/generations failed');
    res.status(500).json({ error: 'Failed to load generations.' });
  }
});

// Delete a generation (same user only) — validated param
app.delete('/api/generations/:id', ...generationIdParamValidation, handleValidationErrors, authMiddleware, async (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params.id, 10);
  const { user } = req as express.Request & { user: AuthedUser };
  const deleted = await deleteGenerationByIdAndUserId(id, user.userId);
  if (!deleted) {
    res.status(404).json({ error: 'Generation not found.' });
    return;
  }
  res.status(204).send();
});

// Download again: regenerate zip from a stored generation (same user only) — validated param
app.get('/api/generations/:id/download', generateLimiter, ...generationIdParamValidation, ...downloadFormatQueryValidation, handleValidationErrors, authMiddleware, async (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params.id, 10);
  const { user } = req as express.Request & { user: AuthedUser };
  const row = await getGenerationByIdAndUserId(id, user.userId);
  if (!row) {
    res.status(404).json({ error: 'Generation not found.' });
    return;
  }
  let config: ProjectConfig;
  try {
    const network = JSON.parse(row.NetworkJson) as ProjectConfig['network'];
    const services = JSON.parse(row.ServicesJson) as ProjectConfig['services'];
    const region = (row.Region === 'westeurope' || row.Region === 'swedencentral' || row.Region === 'belgiumcentral')
      ? row.Region
      : 'westeurope';
    config = {
      projectName: row.ProjectName,
      resourceGroupName: row.ResourceGroupName,
      region,
      network,
      services,
    };
  } catch (err) {
    getLogger().error({ err }, 'Download again: invalid stored JSON');
    res.status(500).json({ error: 'Stored generation data is invalid.' });
    return;
  }
  const requestedFormat = req.query.format as string | undefined;
  const format = (requestedFormat === 'terraform' || requestedFormat === 'bicep') ? requestedFormat : (row.Format === 'terraform' ? 'terraform' : 'bicep');
  let tempDir: string | null = null;
  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cloud-builder-'));
    if (format === 'bicep') {
      await generateBicep(config, tempDir);
    } else {
      await generateTerraform(config, tempDir);
    }
    const archive = archiver('zip', { zlib: { level: 6 } });
    res.attachment(`${config.projectName}-${format}.zip`);
    archive.pipe(res);
    archive.directory(tempDir, false);
    await archive.finalize();
  } catch (err) {
    getLogger().error({ err }, 'Download again: generation failed');
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Generation failed.' });
    }
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

// Generator changelog (public — short notes when templates/catalog change)
app.get('/api/changelog', (_req, res) => {
  res.json({ entries: GENERATOR_CHANGELOG });
});

// Service catalog and defaults for the wizard (protected so wizard is behind login)
app.get('/api/catalog', authMiddleware, (_req, res) => {
  res.json({ services: SERVICE_CATALOG });
});

app.get('/api/default-network/:projectName', authMiddleware, (req, res) => {
  const network = buildDefaultNetwork(req.params.projectName || 'project');
  res.json(network);
});

// Generate IaC and return as ZIP (protected, rate limited, validated)
app.post(
  '/api/generate',
  generateLimiter,
  authMiddleware,
  ...generateValidation,
  handleValidationErrors,
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { config } = req.body as { config: ProjectConfig };
    const msg = validateGenerateConfigBody(config);
    if (msg) {
      res.status(400).json({ error: msg });
      return;
    }
    next();
  },
  async (req: express.Request, res: express.Response) => {
  const { config, format, clientId } = req.body as {
    config: ProjectConfig;
    format: 'bicep' | 'terraform';
    clientId?: number | null;
  };

  const { user } = req as express.Request & { user: AuthedUser };
  let resolvedClientId: number | null = null;
  if (clientId != null && Number.isFinite(clientId)) {
    if (!process.env.AZURE_SQL_CONNECTION_STRING) {
      res.status(503).json({ error: 'Assigning a client requires a configured database.' });
      return;
    }
    const row = await findClientByIdAndUserId(clientId, user.userId);
    if (!row) {
      res.status(400).json({ error: 'Invalid client: not found or not yours.' });
      return;
    }
    resolvedClientId = row.Id;
  }

  let tempDir: string | null = null;
  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cloud-builder-'));
    if (format === 'bicep') {
      await generateBicep(config, tempDir);
    } else {
      await generateTerraform(config, tempDir);
    }

    const validation = format === 'bicep' ? validateBicep(tempDir) : validateTerraform(tempDir);

    await saveGeneration(config, format, user.userId, validation, resolvedClientId);

    const archive = archiver('zip', { zlib: { level: 6 } });
    res.attachment(`${config.projectName}-${format}.zip`);
    archive.pipe(res);

    archive.directory(tempDir, false);
    await archive.finalize();
  } catch (err) {
    getLogger().error({ err }, 'POST /api/generate failed');
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Generation failed.' });
    }
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
},
);

// SPA fallback (only if built)
app.get('*', async (_req, res) => {
  const index = path.join(WEB_DIR, 'index.html');
  try {
    await fs.access(index);
    res.sendFile(index);
  } catch {
    res.status(404).send('Not found. Run "npm run build:web" then start the server.');
  }
});

app.listen(PORT, () => {
  baseLogger.info({ port: PORT }, 'Cloud Builder server listening');
});
