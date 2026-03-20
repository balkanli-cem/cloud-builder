import type { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, type ValidationChain } from 'express-validator';
import type { ProjectConfig } from './types/index';
import { getNetworkMode, serviceUsesSharedSubnet } from './core/services/networkPolicy';

/**
 * Sends 400 with validation errors. Use after running validation chains.
 * Returns a single error message (first error) and optional details.
 */
export function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const result = validationResult(req);
  if (result.isEmpty()) {
    next();
    return;
  }
  const errors = result.array({ onlyFirstError: false });
  const first = errors[0];
  const message = first?.type === 'field' ? `${(first as { path: string }).path}: ${first.msg}` : first?.msg ?? 'Validation failed';
  res.status(400).json({
    error: message,
    errors: result.array({ onlyFirstError: false }).map((e) => ({ path: (e as { path: string }).path, msg: e.msg })),
  });
}

const RESOURCE_NAME = /^[a-z0-9-]+$/;

export const registerValidation: ValidationChain[] = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Valid email required')
    .normalizeEmail()
    .isLength({ max: 256 })
    .withMessage('Email too long'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('displayName')
    .optional()
    .trim()
    .isLength({ max: 128 })
    .withMessage('Display name must be at most 128 characters'),
];

export const loginValidation: ValidationChain[] = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Valid email required')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

export const forgotPasswordValidation: ValidationChain[] = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Valid email required')
    .normalizeEmail(),
];

export const resetPasswordValidation: ValidationChain[] = [
  body('token').trim().notEmpty().withMessage('Reset token is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

const REGIONS = ['westeurope', 'swedencentral', 'belgiumcentral'] as const;

export const generateValidation: ValidationChain[] = [
  body('format')
    .isIn(['bicep', 'terraform'])
    .withMessage('format must be "bicep" or "terraform"'),
  body('config')
    .isObject()
    .withMessage('config is required'),
  body('config.projectName')
    .trim()
    .notEmpty()
    .withMessage('projectName is required')
    .isLength({ max: 256 })
    .withMessage('projectName too long')
    .matches(RESOURCE_NAME)
    .withMessage('projectName: only lowercase letters, numbers, and hyphens'),
  body('config.resourceGroupName')
    .trim()
    .notEmpty()
    .withMessage('resourceGroupName is required')
    .isLength({ max: 256 })
    .withMessage('resourceGroupName too long'),
  body('config.region')
    .isIn(REGIONS)
    .withMessage(`region must be one of: ${REGIONS.join(', ')}`),
  body('config.network')
    .isObject()
    .withMessage('network is required'),
  body('config.network.vnetName')
    .trim()
    .notEmpty()
    .withMessage('network.vnetName is required')
    .isLength({ max: 256 })
    .withMessage('network.vnetName too long'),
  body('config.network.addressSpace')
    .trim()
    .notEmpty()
    .withMessage('network.addressSpace is required')
    .isLength({ max: 64 })
    .withMessage('network.addressSpace too long'),
  body('config.network.subnets')
    .isArray({ min: 1 })
    .withMessage('network.subnets must be a non-empty array'),
  body('config.services')
    .isArray({ min: 1 })
    .withMessage('services must be a non-empty array'),
];

export const generationIdParamValidation: ValidationChain[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id must be a positive integer')
    .toInt(),
];

/** Optional format for download-again (defaults to stored format if omitted). */
export const downloadFormatQueryValidation: ValidationChain[] = [
  query('format')
    .optional()
    .isIn(['bicep', 'terraform'])
    .withMessage('format must be "bicep" or "terraform"'),
];

/**
 * Semantic checks after express-validator (subnet placement vs catalog network mode).
 */
export function validateGenerateConfigBody(config: ProjectConfig): string | null {
  const subnetNames = new Set(config.network.subnets.map((s) => s.name));
  if (config.network.subnets.length === 0) {
    return 'network.subnets must include at least one subnet.';
  }
  for (const svc of config.services) {
    const mode = getNetworkMode(svc.type);
    if (mode === 'subnet_required') {
      const placement = svc.subnetPlacement;
      if (!placement || !subnetNames.has(String(placement))) {
        return `Service "${svc.name}" (${svc.type}) must use a subnet from your network design.`;
      }
    }
    if (serviceUsesSharedSubnet(svc)) {
      const placement = svc.subnetPlacement;
      if (!placement || !subnetNames.has(String(placement))) {
        return `Service "${svc.name}": pick a valid subnet for the shared VNet, or switch to managed networking where available.`;
      }
    }
  }
  return null;
}
