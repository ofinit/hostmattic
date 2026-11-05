import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

// SECURITY: No hardcoded fallback. The app MUST have JWT_SECRET set in environment.
// Lazy initialization so `next build` can import this module without the env var.
/**
 * A short key is weak but it is still a key the operator chose. Refusing to
 * start over it would take down a working deployment on a judgement call, so
 * this warns once and carries on.
 */
const MIN_SECRET_LENGTH = 32;
let warnedAboutLength = false;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    // Deliberately no fallback.
    //
    // This used to end at a string literal committed to the repository, so an
    // unset JWT_SECRET meant every session token was signed with a key that
    // anyone who could read the source already had - enough to mint a token
    // with role ADMIN. It warned, and called that key "secure".
    //
    // It also accepted ADMIN_PASSWORD as a signing key, which couples two
    // unrelated secrets: rotating the admin password would silently
    // invalidate every live session, and the password would gain a second
    // exposure path through every issued token.
    //
    // Failing closed is the point. Without a key this app cannot issue or
    // trust a session, and pretending it can is worse than refusing.
    throw new Error(
      'JWT_SECRET is not set, so session tokens cannot be signed or verified. ' +
        'Set it in the deployment environment - there is deliberately no fallback.'
    );
  }

  if (secret.length < MIN_SECRET_LENGTH && !warnedAboutLength) {
    warnedAboutLength = true;
    console.warn(
      `[Hostmattic Auth] JWT_SECRET is ${secret.length} characters; ${MIN_SECRET_LENGTH} or more is ` +
        'recommended so the signing key cannot be brute-forced offline from a captured token.'
    );
  }

  return secret;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
  /**
   * Set when an administrator is viewing the portal AS this customer.
   * Carried in the JWT so every request can be attributed correctly and the
   * client portal can show a persistent banner - impersonation must never be
   * invisible to the person it affects or to the audit trail.
   */
  impersonatedBy?: string;
}

const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: UserSession, expiresIn: string = '24h'): string {
  const payload: Record<string, unknown> = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  if (user.impersonatedBy) payload.impersonatedBy = user.impersonatedBy;

  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): UserSession | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as UserSession;
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
