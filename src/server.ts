import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import archiver from 'archiver';
import { generateBicep } from './generators/bicep/index';
import { generateTerraform } from './generators/terraform/index';
import { buildDefaultNetwork } from './core/network/defaults';
import { SERVICE_CATALOG } from './core/services/catalog';
import { saveGeneration, getGenerationsByUserId } from './db/client';
import { register, login, verifyToken } from './auth';
import type { ProjectConfig } from './types/index';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT ?? 3000;
const WEB_DIR = path.join(__dirname, '..', 'web-dist');

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

// Auth: register (hashed password stored in DB)
app.post('/api/register', async (req, res) => {
  const { email, password, displayName } = req.body as { email?: string; password?: string; displayName?: string };
  const result = await register(email ?? '', password ?? '', displayName);
  if (!result.ok) {
    res.status(result.error.includes('already exists') ? 409 : 400).json({ error: result.error });
    return;
  }
  res.status(201).json({ ok: true, userId: result.userId });
});

// Auth: login (returns JWT; password checked against hash)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const result = await login(email ?? '', password ?? '');
  if (!result.ok) {
    res.status(401).json({ error: result.error });
    return;
  }
  res.json({ token: result.token, email: result.email });
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
    }));
    res.json({ generations });
  } catch (err) {
    console.error('GET /api/generations:', err);
    res.status(500).json({ error: 'Failed to load generations.' });
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

// Generate IaC and return as ZIP (protected)
app.post('/api/generate', authMiddleware, async (req, res) => {
  const { config, format } = req.body as { config: ProjectConfig; format: 'bicep' | 'terraform' };
  if (!config || !format || !config.projectName || !config.network || !Array.isArray(config.services)) {
    res.status(400).json({ error: 'Invalid request: config (projectName, network, services) and format (bicep|terraform) required.' });
    return;
  }
  if (format !== 'bicep' && format !== 'terraform') {
    res.status(400).json({ error: 'format must be "bicep" or "terraform".' });
    return;
  }

  let tempDir: string | null = null;
  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cloud-builder-'));
    if (format === 'bicep') {
      await generateBicep(config, tempDir);
    } else {
      await generateTerraform(config, tempDir);
    }

    // Persist generation details to Azure SQL when connection string is set (linked to user)
    const { user } = req as express.Request & { user: { email: string; userId: number } };
    saveGeneration(config, format, user.userId).catch((err) => console.error('DB save:', err));

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
