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
import type { ProjectConfig } from './types/index';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT ?? 3000;
const WEB_DIR = path.join(__dirname, '..', 'web-dist');

// Serve built frontend (after npm run build:web)
app.use(express.static(WEB_DIR));

// Service catalog and defaults for the wizard
app.get('/api/catalog', (_req, res) => {
  res.json({ services: SERVICE_CATALOG });
});

app.get('/api/default-network/:projectName', (req, res) => {
  const network = buildDefaultNetwork(req.params.projectName || 'project');
  res.json(network);
});

// Generate IaC and return as ZIP
app.post('/api/generate', async (req, res) => {
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
