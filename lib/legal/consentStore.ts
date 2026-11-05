import { prisma } from '@/lib/prisma';
import { CONSENT_PURPOSES, NOTICE_VERSION, isWithdrawable, type ConsentPurposeKey } from './consent';

/**
 * Recording and reading consent.
 *
 * Every function here is written so that a failure cannot break the thing the
 * customer was actually doing. Consent evidence matters, but a signup that
 * dies because a consent row could not be written leaves a person unable to
 * use a service they paid for - and no record either way. So the write is
 * attempted, failures are logged loudly, and the caller carries on.
 */

export interface ConsentState {
  purpose: string;
  granted: boolean;
  noticeVersion: string | null;
  grantedAt: Date | null;
  withdrawnAt: Date | null;
}

/**
 * Records consent for a set of purposes.
 *
 * Append-only by design: a fresh row each time, rather than updating one in
 * place. The history of what someone agreed to, and when, is the evidence.
 */
export async function recordConsent(
  userId: string,
  purposes: ConsentPurposeKey[] | string[],
  source: 'signup' | 'checkout' | 'portal'
): Promise<void> {
  const keys = (purposes || []).filter(Boolean);
  if (!userId || !keys.length) return;

  try {
    await prisma.consentRecord.createMany({
      data: keys.map((purpose) => ({
        userId,
        purpose: String(purpose),
        noticeVersion: NOTICE_VERSION,
        source,
      })),
    });
  } catch (err: any) {
    console.error(
      `[consent] Could not record consent for ${userId} (${keys.join(', ')}):`,
      err?.message
    );
  }
}

/**
 * Withdraws consent for one purpose.
 *
 * Returns false when the purpose is required for the service - withdrawing it
 * means closing the account, which is a different and more consequential
 * action than unticking a box, and must not happen as a side effect.
 */
export async function withdrawConsent(userId: string, purpose: string): Promise<boolean> {
  if (!isWithdrawable(purpose)) return false;

  try {
    await prisma.consentRecord.updateMany({
      where: { userId, purpose, withdrawnAt: null },
      data: { withdrawnAt: new Date() },
    });
    return true;
  } catch (err: any) {
    console.error(`[consent] Could not withdraw ${purpose} for ${userId}:`, err?.message);
    return false;
  }
}

/** Re-grants a purpose that was previously withdrawn. */
export async function grantConsent(userId: string, purpose: string): Promise<boolean> {
  if (!isWithdrawable(purpose)) return false;
  await recordConsent(userId, [purpose], 'portal');
  return true;
}

/**
 * The current state of every purpose for one person.
 *
 * A purpose counts as granted when its most recent record has no withdrawal.
 * Reading the latest row rather than any row matters: someone who withdrew and
 * then re-granted must read as granted, and the reverse must read as withdrawn.
 */
export async function getConsentState(userId: string): Promise<ConsentState[]> {
  let rows: any[] = [];
  try {
    rows = await prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
    });
  } catch (err: any) {
    console.warn('[consent] Could not read consent state:', err?.message);
  }

  return CONSENT_PURPOSES.map((p) => {
    const latest = rows.find((r) => r.purpose === p.key);
    return {
      purpose: p.key,
      granted: Boolean(latest && !latest.withdrawnAt),
      noticeVersion: latest?.noticeVersion ?? null,
      grantedAt: latest?.grantedAt ?? null,
      withdrawnAt: latest?.withdrawnAt ?? null,
    };
  });
}

/** Whether one purpose is currently granted. */
export async function hasConsent(userId: string, purpose: string): Promise<boolean> {
  const state = await getConsentState(userId);
  return Boolean(state.find((s) => s.purpose === purpose)?.granted);
}
