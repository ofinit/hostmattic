/**
 * Password reset grants.
 *
 * The previous implementation generated a 32-byte token, put it in a link,
 * emailed it, and stored nothing. No route ever read it back and the login
 * page ignored the query parameter, so every reset link in every email ever
 * sent did nothing at all. Anyone locked out stayed locked out.
 *
 * What this does differently:
 *
 *  - Only sha256(token) is stored. The raw token exists in the emailed link
 *    and nowhere else, so reading the database does not let someone take over
 *    an account - a reset table full of usable tokens is a far better target
 *    than the password hashes beside it.
 *  - Single use, and short lived. A link that works forever is a password.
 *  - Redeeming one invalidates every other outstanding token for that user,
 *    because the usual reason for resetting is that something was
 *    compromised.
 *  - Lookup is by hash, which is unique and indexed, so no part of this
 *    depends on the email address in the link matching anything.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/** How long a link stays usable. Long enough to find the email, short enough to matter. */
export const RESET_TTL_MINUTES = 60;

export type ResetScope = 'CUSTOMER' | 'ADMIN';

export interface IssuedToken {
  /** The raw token. Goes in the link and is never stored. */
  token: string;
  expiresAt: Date;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a grant for a user. Any outstanding ones are invalidated first:
 * requesting a new link should make the previous one stop working, or a
 * forwarded old email stays live.
 */
export async function issueResetToken(
  userId: string,
  scope: ResetScope,
  requestedIp?: string
): Promise<IssuedToken> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      scope,
      expiresAt,
      requestedIp: requestedIp || null,
    },
  });

  return { token, expiresAt };
}

export type ResetCheck =
  | { ok: true; userId: string; scope: ResetScope; email: string; name: string }
  | { ok: false; reason: 'unknown' | 'used' | 'expired'; message: string };

/**
 * Whether a raw token can still be redeemed.
 *
 * The three failure reasons are kept apart because they need different
 * advice: an expired link should be requested again, a used one means the
 * reset already happened, and an unknown one is usually a truncated link from
 * a mail client that wrapped it.
 */
export async function checkResetToken(token: string): Promise<ResetCheck> {
  const raw = String(token || '').trim();
  if (!raw) {
    return { ok: false, reason: 'unknown', message: 'This reset link is missing its token.' };
  }

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!row || !row.user) {
    return {
      ok: false,
      reason: 'unknown',
      message:
        'This reset link is not valid. It may have been copied incompletely - check that the ' +
        'whole link came through, or request a new one.',
    };
  }
  if (row.usedAt) {
    return {
      ok: false,
      reason: 'used',
      message:
        'This reset link has already been used. If you did not reset your password, request a ' +
        'new link and contact us.',
    };
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return {
      ok: false,
      reason: 'expired',
      message: `This reset link has expired. Links are valid for ${RESET_TTL_MINUTES} minutes - request a new one.`,
    };
  }

  return {
    ok: true,
    userId: row.user.id,
    scope: (row.scope as ResetScope) || 'CUSTOMER',
    email: row.user.email,
    name: row.user.name,
  };
}

/**
 * Marks a token used and writes the new hash, in one transaction.
 *
 * The token is re-checked INSIDE the transaction and the update is conditional
 * on it still being unused, so two submissions of the same link cannot both
 * succeed.
 */
export async function redeemResetToken(
  token: string,
  newPasswordHash: string
): Promise<{ ok: true; userId: string; scope: ResetScope } | { ok: false; message: string }> {
  const check = await checkResetToken(token);
  if (!check.ok) return { ok: false, message: check.message };

  const tokenHash = hashToken(String(token).trim());

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Conditional on usedAt still being null: if a concurrent request got
      // here first, this updates nothing and we stop.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) return null;

      await tx.user.update({
        where: { id: check.userId },
        data: { passwordHash: newPasswordHash },
      });

      // Everything else outstanding for this user dies too.
      await tx.passwordResetToken.updateMany({
        where: { userId: check.userId, usedAt: null },
        data: { usedAt: new Date() },
      });

      return { userId: check.userId, scope: check.scope };
    });

    if (!result) {
      return { ok: false, message: 'This reset link has already been used.' };
    }
    return { ok: true, ...result };
  } catch (err: any) {
    console.error('[Password reset] redeem failed:', err?.message);
    return { ok: false, message: 'The password could not be changed. Please try again.' };
  }
}
