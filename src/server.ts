import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import archiver from 'archiver';
import { generateBicep } from './generators/bicep/index';
import { generateTerraform } from './generators/terraform/index';
import { validateBicep, validateTerraform } from './validation-iac';
import { buildDefaultNetwork } from './core/network/defaults';
import { SERVICE_CATALOG } from './core/services/catalog';
import { saveGeneration, getGenerationsByUserId, getGenerationByIdAndUserId, deleteGenerationByIdAndUserId, checkDatabase } from './db/client';
import { register, login, verifyToken, requestPasswordReset, resetPassword } from './auth';
import {
  handleValidationErrors,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  generateValidation,
  generationIdParamValidation,
  downloadFormatQueryValidation,
} from './validation';
import type { ProjectConfig } from './types/index';

const app = express();
app.set('trust proxy', 1); // so req.ip is the client IP when behind Azure/nginx
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT ?? 3000;
const WEB_DIR = path.join(__dirname, '..', 'web-dist');

// ─── Rate limiting ───────────────────────────────────────────────────────────
// Limits how many requests a client (by IP) can make in a time window. Prevents
// brute-force (login/register) and abuse (generate). Each limiter counts per IP.
// When the limit is exceeded, the client gets HTTP 429 and must wait for the window to reset.

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Auth: strict limit to slow down brute-force and credential stuffing. */
const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 10,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,  // X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  legacyHeaders: false,
});

/** Generate: cap heavy requests per IP so one client cannot overload the server. */
const generateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 30,
  message: { error: 'Too many generations. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
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
  (req as express.Request & { user: { email: string; userId: number } }).user = payload;
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
  const result = await login(email, password);
  if (!result.ok) {
    res.status(401).json({ error: result.error });
    return;
  }
  res.json({ token: result.token, email: result.email });
});

// Auth: forgot password — always 200 with generic message (no user enumeration); rate limited
app.post('/api/forgot-password', authLimiter, ...forgotPasswordValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  const { email } = req.body as { email: string };
  const result = await requestPasswordReset(email);
  if (result.ok) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[forgot-password] Reset link (do not log in production):', result.resetLink);
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
  const { user } = req as express.Request & { user: { email: string; userId: number } };
  res.json({ email: user.email });
});

// List generations for the current user (for "My generations" dashboard)
app.get('/api/generations', authMiddleware, async (req, res) => {
  const { user } = req as express.Request & { user: { email: string; userId: number } };
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
    console.error('GET /api/generations:', err);
    res.status(500).json({ error: 'Failed to load generations.' });
  }
});

// Delete a generation (same user only) — validated param
app.delete('/api/generations/:id', ...generationIdParamValidation, handleValidationErrors, authMiddleware, async (req: express.Request, res: express.Response) => {
  const id = parseInt(req.params.id, 10);
  const { user } = req as express.Request & { user: { email: string; userId: number } };
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
  const { user } = req as express.Request & { user: { email: string; userId: number } };
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
    console.error('Download again: invalid stored JSON', err);
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
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Generation failed.' });
    }
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
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
app.post('/api/generate', generateLimiter, authMiddleware, ...generateValidation, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  const { config, format } = req.body as { config: ProjectConfig; format: 'bicep' | 'terraform' };

  let tempDir: string | null = null;
  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cloud-builder-'));
    if (format === 'bicep') {
      await generateBicep(config, tempDir);
    } else {
      await generateTerraform(config, tempDir);
    }

    const validation = format === 'bicep' ? validateBicep(tempDir) : validateTerraform(tempDir);

    const { user } = req as express.Request & { user: { email: string; userId: number } };
    await saveGeneration(config, format, user.userId, validation);

    const archive = archiver('zip', { zlib: { level: 6 } });
    res.attachment(`${config.projectName}-${format}.zip`);
    archive.pipe(res);

    archive.directory(tempDir, false);
    await archive.finalize();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Generation failed.' });
    }
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

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
  console.log(`Cloud Builder server at http://localhost:${PORT}`);
});
