import { spawnSync } from 'child_process';
import path from 'path';

const VALIDATE_TIMEOUT_MS = 60_000;

export type ValidationStatus = 'success' | 'warning' | 'error' | 'skipped';

export interface ValidationResult {
  status: ValidationStatus;
  message: string;
}

/**
 * Runs `bicep build main.bicep` in the given directory.
 * Returns success/warning/error/skipped and a short message.
 */
export function validateBicep(outputDir: string): ValidationResult {
  const mainBicep = path.join(outputDir, 'main.bicep');
  try {
    const result = spawnSync('bicep', ['build', 'main.bicep'], {
      cwd: outputDir,
      encoding: 'utf8',
      timeout: VALIDATE_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });
    if (result.error) {
      if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { status: 'skipped', message: 'Bicep CLI not installed' };
      }
      return { status: 'error', message: result.error.message };
    }
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    if (result.status === 0) {
      const hasWarnings = /warning/i.test(stderr) || /warning/i.test(stdout);
      return {
        status: hasWarnings ? 'warning' : 'success',
        message: hasWarnings ? stderr || stdout || 'Build succeeded with warnings' : 'Valid',
      };
    }
    const msg = stderr || stdout || `Exit code ${result.status}`;
    return { status: 'error', message: msg.slice(0, 2000) };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Validation failed',
    };
  }
}

/**
 * Runs `terraform init -backend=false` then `terraform validate -no-color` in the given directory.
 * Returns success/warning/error/skipped and a short message.
 */
export function validateTerraform(outputDir: string): ValidationResult {
  try {
    const init = spawnSync('terraform', ['init', '-backend=false', '-input=false'], {
      cwd: outputDir,
      encoding: 'utf8',
      timeout: VALIDATE_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });
    if (init.error) {
      if ((init.error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { status: 'skipped', message: 'Terraform CLI not installed' };
      }
      return { status: 'error', message: init.error.message };
    }
    const validate = spawnSync('terraform', ['validate', '-no-color'], {
      cwd: outputDir,
      encoding: 'utf8',
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    });
    if (validate.error) {
      return { status: 'error', message: validate.error.message };
    }
    const stderr = (validate.stderr || '').trim();
    const stdout = (validate.stdout || '').trim();
    const out = stderr || stdout;
    if (validate.status === 0) {
      const hasWarnings = /warning/i.test(out);
      return {
        status: hasWarnings ? 'warning' : 'success',
        message: hasWarnings ? out.slice(0, 1000) : 'Valid',
      };
    }
    return { status: 'error', message: out.slice(0, 2000) || `Exit code ${validate.status}` };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Validation failed',
    };
  }
}
