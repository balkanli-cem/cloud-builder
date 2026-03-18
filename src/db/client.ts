import sql from 'mssql';
import type { ProjectConfig } from '../types/index';
import { getLogger } from '../logger';

const CONNECTION_STRING = process.env.AZURE_SQL_CONNECTION_STRING;

let pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool | null> {
  if (!CONNECTION_STRING) return null;
  if (pool) return pool;
  try {
    pool = await sql.connect(CONNECTION_STRING);
    return pool;
  } catch (err) {
    getLogger().error({ err }, 'DB connection failed');
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
  ValidationStatus?: string | null;
  ValidationMessage?: string | null;
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
    getLogger().error({ err }, 'getGenerationByIdAndUserId');
    return null;
  }
}

/**
 * Deletes a generation only if it belongs to the given user. Returns true if a row was deleted.
 */
export async function deleteGenerationByIdAndUserId(id: number, userId: number): Promise<boolean> {
  const p = await getPool();
  if (!p) return false;
  try {
    const result = await p.request()
      .input('id', sql.Int, id)
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM dbo.Generations WHERE Id = @id AND UserId = @userId`);
    const affected = (result as { rowsAffected: number[] }).rowsAffected;
    return Array.isArray(affected) && affected[0] > 0;
  } catch (err) {
    getLogger().error({ err }, 'deleteGenerationByIdAndUserId');
    return false;
  }
}

/**
 * Saves a generation record to Azure SQL. No-op if AZURE_SQL_CONNECTION_STRING is not set.
 * userId is set when the user is logged in so generations appear in "My generations".
 * validationStatus/validationMessage are optional (run schema-validation.sql to add columns).
 */
export async function saveGeneration(
  config: ProjectConfig,
  format: 'bicep' | 'terraform',
  userId?: number | null,
  validation?: { status: string; message: string } | null,
): Promise<void> {
  const p = await getPool();
  if (!p) return;

  const status = validation?.status ?? null;
  const message = validation?.message ?? null;

  try {
    const req = p.request()
      .input('projectName', sql.NVarChar(256), config.projectName)
      .input('resourceGroupName', sql.NVarChar(256), config.resourceGroupName)
      .input('region', sql.NVarChar(64), config.region)
      .input('networkJson', sql.NVarChar(sql.MAX as number), JSON.stringify(config.network))
      .input('servicesJson', sql.NVarChar(sql.MAX as number), JSON.stringify(config.services))
      .input('format', sql.NVarChar(32), format)
      .input('validationStatus', sql.NVarChar(20), status)
      .input('validationMessage', sql.NVarChar(sql.MAX as number), message);
    if (userId != null) {
      req.input('userId', sql.Int, userId);
      await req.query(`
        INSERT INTO dbo.Generations (UserId, ProjectName, ResourceGroupName, Region, NetworkJson, ServicesJson, Format, ValidationStatus, ValidationMessage)
        VALUES (@userId, @projectName, @resourceGroupName, @region, @networkJson, @servicesJson, @format, @validationStatus, @validationMessage)
      `);
    } else {
      await req.query(`
        INSERT INTO dbo.Generations (ProjectName, ResourceGroupName, Region, NetworkJson, ServicesJson, Format, ValidationStatus, ValidationMessage)
        VALUES (@projectName, @resourceGroupName, @region, @networkJson, @servicesJson, @format, @validationStatus, @validationMessage)
      `);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ValidationStatus') || msg.includes('ValidationMessage') || msg.includes('Invalid column')) {
      try {
        const req2 = p.request()
          .input('projectName', sql.NVarChar(256), config.projectName)
          .input('resourceGroupName', sql.NVarChar(256), config.resourceGroupName)
          .input('region', sql.NVarChar(64), config.region)
          .input('networkJson', sql.NVarChar(sql.MAX as number), JSON.stringify(config.network))
          .input('servicesJson', sql.NVarChar(sql.MAX as number), JSON.stringify(config.services))
          .input('format', sql.NVarChar(32), format);
        if (userId != null) {
          req2.input('userId', sql.Int, userId);
          await req2.query(`
            INSERT INTO dbo.Generations (UserId, ProjectName, ResourceGroupName, Region, NetworkJson, ServicesJson, Format)
            VALUES (@userId, @projectName, @resourceGroupName, @region, @networkJson, @servicesJson, @format)
          `);
        } else {
          await req2.query(`
            INSERT INTO dbo.Generations (ProjectName, ResourceGroupName, Region, NetworkJson, ServicesJson, Format)
            VALUES (@projectName, @resourceGroupName, @region, @networkJson, @servicesJson, @format)
          `);
        }
      } catch (err2) {
        getLogger().error({ err: err2 }, 'Failed to save generation to DB (fallback insert)');
      }
    } else {
      getLogger().error({ err }, 'Failed to save generation to DB');
    }
  }
}

/**
 * Returns generations for a user (for "My generations" list). Empty array if DB not configured.
 * If ValidationStatus/ValidationMessage columns are missing (migration not run), returns rows with null for those.
 */
export async function getGenerationsByUserId(userId: number): Promise<GenerationRow[]> {
  const p = await getPool();
  if (!p) return [];
  try {
    const result = await p.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT Id, ProjectName, ResourceGroupName, Region, Format, CreatedAt, ValidationStatus, ValidationMessage
        FROM dbo.Generations
        WHERE UserId = @userId
        ORDER BY CreatedAt DESC
      `);
    const rows = (result as { recordset: GenerationRow[] }).recordset;
    return rows ?? [];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ValidationStatus') || msg.includes('ValidationMessage') || msg.includes('Invalid column')) {
      try {
        const fallback = await p.request()
          .input('userId', sql.Int, userId)
          .query(`
            SELECT Id, ProjectName, ResourceGroupName, Region, Format, CreatedAt
            FROM dbo.Generations
            WHERE UserId = @userId
            ORDER BY CreatedAt DESC
          `);
        const rows = (fallback as { recordset: (Omit<GenerationRow, 'ValidationStatus' | 'ValidationMessage'>)[] }).recordset;
        return (rows ?? []).map((r) => ({ ...r, ValidationStatus: null, ValidationMessage: null }));
      } catch {
        getLogger().error({ err }, 'getGenerationsByUserId (fallback)');
        return [];
      }
    }
    getLogger().error({ err }, 'getGenerationsByUserId');
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
    getLogger().error({ err }, 'findUserByEmail');
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
    getLogger().error({ err }, 'createUser');
    return null;
  }
}

/**
 * Sets password reset token and expiry for a user by email. No-op if DB not configured or column missing.
 */
export async function setPasswordResetToken(email: string, tokenHash: string, expiresAt: Date): Promise<boolean> {
  const p = await getPool();
  if (!p) return false;
  try {
    const result = await p.request()
      .input('email', sql.NVarChar(256), email.trim().toLowerCase())
      .input('tokenHash', sql.NVarChar(256), tokenHash)
      .input('expiresAt', sql.NVarChar(30), expiresAt.toISOString())
      .query(`
        UPDATE dbo.Users
        SET PasswordResetTokenHash = @tokenHash, PasswordResetExpiresAt = CONVERT(DATETIME2(7), @expiresAt, 127), UpdatedAt = SYSUTCDATETIME()
        WHERE Email = @email
      `);
    const affected = (result as { rowsAffected: number[] }).rowsAffected;
    return Array.isArray(affected) && affected[0] > 0;
  } catch (err) {
    getLogger().error({ err }, 'setPasswordResetToken');
    return false;
  }
}

/**
 * Returns user Id for a valid (non-expired) reset token hash, or null.
 */
export async function findUserIdByResetToken(tokenHash: string): Promise<number | null> {
  const p = await getPool();
  if (!p) return null;
  try {
    const result = await p.request()
      .input('tokenHash', sql.NVarChar(256), tokenHash)
      .query(`
        SELECT Id FROM dbo.Users
        WHERE PasswordResetTokenHash = @tokenHash AND PasswordResetExpiresAt > SYSUTCDATETIME()
      `);
    const rows = (result as { recordset: { Id: number }[] }).recordset;
    return rows[0]?.Id ?? null;
  } catch (err) {
    getLogger().error({ err }, 'findUserIdByResetToken');
    return null;
  }
}

/**
 * Updates password and clears reset token for the user. Returns true if a row was updated.
 */
export async function updatePasswordAndClearResetToken(userId: number, passwordHash: string): Promise<boolean> {
  const p = await getPool();
  if (!p) return false;
  try {
    const result = await p.request()
      .input('userId', sql.Int, userId)
      .input('passwordHash', sql.NVarChar(256), passwordHash)
      .query(`
        UPDATE dbo.Users
        SET PasswordHash = @passwordHash, PasswordResetTokenHash = NULL, PasswordResetExpiresAt = NULL, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @userId
      `);
    const affected = (result as { rowsAffected: number[] }).rowsAffected;
    return Array.isArray(affected) && affected[0] > 0;
  } catch (err) {
    getLogger().error({ err }, 'updatePasswordAndClearResetToken');
    return false;
  }
}
