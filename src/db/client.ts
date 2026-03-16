import sql from 'mssql';
import type { ProjectConfig } from '../types/index';

const CONNECTION_STRING = process.env.AZURE_SQL_CONNECTION_STRING;

let pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool | null> {
  if (!CONNECTION_STRING) return null;
  if (pool) return pool;
  try {
    pool = await sql.connect(CONNECTION_STRING);
    return pool;
  } catch (err) {
    console.error('DB connection failed:', err);
    return null;
  }
}

/**
 * Returns true if the database is reachable (or not configured). Used for readiness probes.
 */
export async function checkDatabase(): Promise<{ ok: boolean; configured: boolean }> {
  if (!CONNECTION_STRING) return { ok: true, configured: false };
  const p = await getPool();
  if (!p) return { ok: false, configured: true };
  try {
    await p.request().query('SELECT 1');
    return { ok: true, configured: true };
  } catch {
    return { ok: false, configured: true };
  }
}

export interface GenerationRow {
  Id: number;
  ProjectName: string;
  ResourceGroupName: string;
  Region: string;
  Format: string;
  CreatedAt: Date;
}

/** Full row with JSON columns, for "download again" (reconstruct config and regenerate zip). */
export interface GenerationFullRow extends GenerationRow {
  NetworkJson: string;
  ServicesJson: string;
}

/**
 * Returns one generation by id only if it belongs to the given user. Used for download again.
 */
export async function getGenerationByIdAndUserId(id: number, userId: number): Promise<GenerationFullRow | null> {
  const p = await getPool();
  if (!p) return null;
  try {
    const result = await p.request()
      .input('id', sql.Int, id)
      .input('userId', sql.Int, userId)
      .query(`
        SELECT Id, ProjectName, ResourceGroupName, Region, NetworkJson, ServicesJson, Format, CreatedAt
        FROM dbo.Generations
        WHERE Id = @id AND UserId = @userId
      `);
    const rows = (result as { recordset: GenerationFullRow[] }).recordset;
    return rows[0] ?? null;
  } catch (err) {
    console.error('getGenerationByIdAndUserId:', err);
    return null;
  }
}

/**
 * Saves a generation record to Azure SQL. No-op if AZURE_SQL_CONNECTION_STRING is not set.
 * userId is set when the user is logged in so generations appear in "My generations".
 */
export async function saveGeneration(
  config: ProjectConfig,
  format: 'bicep' | 'terraform',
  userId?: number | null,
): Promise<void> {
  const p = await getPool();
  if (!p) return;

  try {
    const req = p.request()
      .input('projectName', sql.NVarChar(256), config.projectName)
      .input('resourceGroupName', sql.NVarChar(256), config.resourceGroupName)
      .input('region', sql.NVarChar(64), config.region)
      .input('networkJson', sql.NVarChar(sql.MAX as number), JSON.stringify(config.network))
      .input('servicesJson', sql.NVarChar(sql.MAX as number), JSON.stringify(config.services))
      .input('format', sql.NVarChar(32), format);
    if (userId != null) {
      req.input('userId', sql.Int, userId);
      await req.query(`
        INSERT INTO dbo.Generations (UserId, ProjectName, ResourceGroupName, Region, NetworkJson, ServicesJson, Format)
        VALUES (@userId, @projectName, @resourceGroupName, @region, @networkJson, @servicesJson, @format)
      `);
    } else {
      await req.query(`
        INSERT INTO dbo.Generations (ProjectName, ResourceGroupName, Region, NetworkJson, ServicesJson, Format)
        VALUES (@projectName, @resourceGroupName, @region, @networkJson, @servicesJson, @format)
      `);
    }
  } catch (err) {
    console.error('Failed to save generation to DB:', err);
  }
}

/**
 * Returns generations for a user (for "My generations" list). Empty array if DB not configured.
 */
export async function getGenerationsByUserId(userId: number): Promise<GenerationRow[]> {
  const p = await getPool();
  if (!p) return [];
  try {
    const result = await p.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT Id, ProjectName, ResourceGroupName, Region, Format, CreatedAt
        FROM dbo.Generations
        WHERE UserId = @userId
        ORDER BY CreatedAt DESC
      `);
    const rows = (result as { recordset: GenerationRow[] }).recordset;
    return rows ?? [];
  } catch (err) {
    console.error('getGenerationsByUserId:', err);
    return [];
  }
}

export interface UserRow {
  Id: number;
  Email: string;
  PasswordHash: string;
  DisplayName: string | null;
}

/**
 * Finds a user by email. Returns null if DB not configured or user not found.
 */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const p = await getPool();
  if (!p) return null;
  try {
    const result = await p.request()
      .input('email', sql.NVarChar(256), email.trim().toLowerCase())
      .query(`SELECT Id, Email, PasswordHash, DisplayName FROM dbo.Users WHERE Email = @email`);
    const rows = (result as { recordset: UserRow[] }).recordset;
    return rows[0] ?? null;
  } catch (err) {
    console.error('findUserByEmail:', err);
    return null;
  }
}

/**
 * Creates a user with an already-hashed password. No-op if DB not configured.
 */
export async function createUser(email: string, passwordHash: string, displayName: string | null): Promise<number | null> {
  const p = await getPool();
  if (!p) return null;
  try {
    const result = await p.request()
      .input('email', sql.NVarChar(256), email.trim().toLowerCase())
      .input('passwordHash', sql.NVarChar(256), passwordHash)
      .input('displayName', sql.NVarChar(128), displayName?.trim() || null)
      .query(`
        INSERT INTO dbo.Users (Email, PasswordHash, DisplayName)
        OUTPUT INSERTED.Id
        VALUES (@email, @passwordHash, @displayName)
      `);
    const rows = (result as { recordset: { Id: number }[] }).recordset;
    return rows[0]?.Id ?? null;
  } catch (err) {
    console.error('createUser:', err);
    return null;
  }
}
