import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail, createUser } from './db/client';

const JWT_SECRET = process.env.JWT_SECRET ?? 'cloud-builder-dev-secret-change-in-production';
const SALT_ROUNDS = 10;

export interface TokenPayload {
  email: string;
  userId: number;
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

export async function login(email: string, password: string): Promise<{ ok: true; token: string; email: string } | { ok: false; error: string }> {
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

  const token = signToken({ email: user.Email, userId: user.Id });
  return { ok: true, token, email: user.Email };
}
