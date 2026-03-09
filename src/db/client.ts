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
 * Saves a generation record to Azure SQL. No-op if AZURE_SQL_CONNECTION_STRING is not set.
 */
export async function saveGeneration(config: ProjectConfig, format: 'bicep' | 'terraform'): Promise<void> {
  const p = await getPool();
  if (!p) return;

  try {
    await p.request()
      .input('projectName', sql.NVarChar(256), config.projectName)
      .input('resourceGroupName', sql.NVarChar(256), config.resourceGroupName)
      .input('region', sql.NVarChar(64), config.region)
      .input('networkJson', sql.NVarChar(sql.MAX as number), JSON.stringify(config.network))
      .input('servicesJson', sql.NVarChar(sql.MAX as number), JSON.stringify(config.services))
      .input('format', sql.NVarChar(32), format)
      .query(`
        INSERT INTO dbo.Generations (ProjectName, ResourceGroupName, Region, NetworkJson, ServicesJson, Format)
        VALUES (@projectName, @resourceGroupName, @region, @networkJson, @servicesJson, @format)
      `);
  } catch (err) {
    console.error('Failed to save generation to DB:', err);
  }
}
