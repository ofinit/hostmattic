import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

// SECURITY: No hardcoded fallback. The app MUST have JWT_SECRET set in environment.
const _jwtSecret = process.env.JWT_SECRET;
if (!_jwtSecret) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. ' +
    'Generate a strong random secret (e.g. `openssl rand -base64 64`) and add it to your .env file. ' +
    'The application will not start without it.'
  );
}
const JWT_SECRET: string = _jwtSecret;

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
}

const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: UserSession): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): UserSession | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserSession;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the session from the auth cookie.
 * Returns null if no valid session exists.
 */
export function getSession(req: NextRequest): UserSession | null {
  const token = req.cookies.get('hm_auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Requires a valid authenticated session. Returns 401 if not authenticated.
 * Usage: const session = requireAuth(req); if (session instanceof NextResponse) return session;
 */
export function requireAuth(req: NextRequest): UserSession | NextResponse {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Authentication required. Please log in.' },
      { status: 401 }
    );
  }
  return session;
}

/**
 * Requires a valid authenticated session with ADMIN role. Returns 401/403 as appropriate.
 * Usage: const session = requireAdmin(req); if (session instanceof NextResponse) return session;
 */
export function requireAdmin(req: NextRequest): UserSession | NextResponse {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Authentication required. Please log in.' },
      { status: 401 }
    );
  }
  if (session.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Admin access required.' },
      { status: 403 }
    );
  }
  return session;
}
