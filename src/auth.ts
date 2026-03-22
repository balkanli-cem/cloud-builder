import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  findUserByEmail,
  createUser,
  setPasswordResetToken,
  findUserIdByResetToken,
  updatePasswordAndClearResetToken,
  createSession,
  recordLoginEvent,
} from './db/client';

const JWT_SECRET = process.env.JWT_SECRET ?? 'cloud-builder-dev-secret-change-in-production';
const SALT_ROUNDS = 10;

/** Set when AZURE_SQL_CONNECTION_STRING is configured (sessions + login audit in DB). */
function hasAuthDatabase(): boolean {
  return !!process.env.AZURE_SQL_CONNECTION_STRING;
}

export interface TokenPayload {
  email: string;
  userId: number;
  /** Session id (JWT jti) when DB-backed sessions are enabled. */
  jti?: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function register(email: string, password: string, displayName?: string | null): Promise<{ ok: true; userId: number } | { ok: false; error: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !password) {
    return { ok: false, error: 'Email and password are required.' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  const existing = await findUserByEmail(trimmed);
  if (existing) {
    return { ok: false, error: 'An account with this email already exists.' };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const userId = await createUser(trimmed, passwordHash, displayName ?? null);
  if (userId == null) {
    return { ok: false, error: 'Registration failed. Database may not be configured.' };
  }
  return { ok: true, userId };
}

export async function login(
  email: string,
  password: string,
  meta?: { ip?: string | null; userAgent?: string | null },
): Promise<{ ok: true; token: string; email: string } | { ok: false; error: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !password) {
    return { ok: false, error: 'Email and password are required.' };
  }

  const user = await findUserByEmail(trimmed);
  if (!user) {
    return { ok: false, error: 'Invalid email or password.' };
  }

  const match = await bcrypt.compare(password, user.PasswordHash);
  if (!match) {
    return { ok: false, error: 'Invalid email or password.' };
  }

  const ip = meta?.ip ?? null;
  const ua = meta?.userAgent ?? null;

  if (hasAuthDatabase()) {
    const jti = crypto.randomUUID();
    const created = await createSession(user.Id, jti, ip, ua);
    if (!created) {
      return { ok: false, error: 'Could not create a session. Please try again.' };
    }
    const token = signToken({ email: user.Email, userId: user.Id, jti });
    await recordLoginEvent(user.Id, user.Email, true, ip, ua);
    return { ok: true, token, email: user.Email };
  }

  const token = signToken({ email: user.Email, userId: user.Id });
  return { ok: true, token, email: user.Email };
}

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Creates a password reset token for the given email and stores its hash in the DB.
 * Returns { ok: true, token, resetLink } if the user exists (caller should send the link by email or log it).
 * Returns { ok: false } without revealing whether the email exists (security: no user enumeration).
 */
export async function requestPasswordReset(email: string): Promise<
  { ok: true; token: string; resetLink: string } | { ok: false }
> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { ok: false };

  const user = await findUserByEmail(trimmed);
  if (!user) return { ok: false };

  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  const updated = await setPasswordResetToken(trimmed, tokenHash, expiresAt);
  if (!updated) return { ok: false };

  const baseUrl = (process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
  const resetLink = baseUrl ? `${baseUrl}?token=${token}` : `"?token=${token}" (set PUBLIC_APP_URL for full link)`;
  return { ok: true, token, resetLink };
}

/**
 * Resets password using a valid reset token. Invalid/expired token returns { ok: false, error: '...' }.
 */
export async function resetPassword(token: string, newPassword: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const t = token.trim();
  if (!t || newPassword.length < 8) {
    return { ok: false, error: 'Token and password (min 8 characters) are required.' };
  }

  const tokenHash = crypto.createHash('sha256').update(t).digest('hex');
  const userId = await findUserIdByResetToken(tokenHash);
  if (!userId) {
    return { ok: false, error: 'Invalid or expired reset link. Request a new one.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const updated = await updatePasswordAndClearResetToken(userId, passwordHash);
  if (!updated) {
    return { ok: false, error: 'Failed to update password.' };
  }
  return { ok: true };
}
