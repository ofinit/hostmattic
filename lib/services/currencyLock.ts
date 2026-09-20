import { prisma } from '@/lib/prisma';

export interface CurrencyLockResult {
  isLocked: boolean;
  lockedCurrency: 'USD' | 'INR' | null;
  userId?: string;
  currencyLockedAt?: Date | null;
}

/**
 * Retrieve the locked currency for a given customer (by email or user ID).
 * If User.lockedCurrency is not yet set, inspects previous paid orders to backfill
 * and guarantee consistency for legacy customers.
 */
export async function getCustomerCurrencyLock(emailOrUserId: string): Promise<CurrencyLockResult> {
  if (!emailOrUserId || typeof emailOrUserId !== 'string') {
    return { isLocked: false, lockedCurrency: null };
  }

  const normalized = emailOrUserId.trim();
  const lowercased = normalized.toLowerCase();

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: normalized }, { email: lowercased }],
      },
      select: {
        id: true,
        email: true,
        lockedCurrency: true,
        currencyLockedAt: true,
      },
    });

    if (!user) {
      return { isLocked: false, lockedCurrency: null };
    }

    // 1. Direct hit on lockedCurrency
    if (user.lockedCurrency === 'USD' || user.lockedCurrency === 'INR') {
      return {
        isLocked: true,
        lockedCurrency: user.lockedCurrency,
        userId: user.id,
        currencyLockedAt: user.currencyLockedAt,
      };
    }

    // 2. Legacy check: Does user have any paid orders?
    const paidOrder = await prisma.order.findFirst({
      where: {
        userId: user.id,
        paymentStatus: 'PAID',
      },
      select: {
        currency: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (paidOrder && (paidOrder.currency === 'USD' || paidOrder.currency === 'INR')) {
      const validCurrency = paidOrder.currency as 'USD' | 'INR';
      // Automatically backfill user profile
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lockedCurrency: validCurrency,
            currencyLockedAt: paidOrder.createdAt,
          },
        });
      } catch (updateErr) {
        console.warn('[CurrencyLock Backfill Notice] Could not update user lock:', updateErr);
      }

      return {
        isLocked: true,
        lockedCurrency: validCurrency,
        userId: user.id,
        currencyLockedAt: paidOrder.createdAt,
      };
    }

    return {
      isLocked: false,
      lockedCurrency: null,
      userId: user.id,
    };
  } catch (err) {
    console.error('[CurrencyLock Service Error] getCustomerCurrencyLock:', err);
    return { isLocked: false, lockedCurrency: null };
  }
}

/**
 * Permanently locks a user's account to a specified currency upon first successful payment.
 */
export async function lockCustomerCurrency(userId: string, currency: 'USD' | 'INR'): Promise<boolean> {
  if (!userId || (currency !== 'USD' && currency !== 'INR')) {
    return false;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, lockedCurrency: true },
    });

    if (!user) return false;

    // If already locked, do not overwrite
    if (user.lockedCurrency) {
      return true;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        lockedCurrency: currency,
        currencyLockedAt: new Date(),
      },
    });

    return true;
  } catch (err) {
    console.error('[CurrencyLock Service Error] lockCustomerCurrency:', err);
    return false;
  }
}

/**
 * Validates whether an incoming checkout/payment request is allowed for a customer.
 */
export async function validateCurrencyMatch(
  emailOrUserId: string,
  requestedCurrency: string
): Promise<{
  allowed: boolean;
  lockedCurrency?: 'USD' | 'INR';
  userId?: string;
  error?: string;
}> {
  const normRequested = requestedCurrency === 'INR' ? 'INR' : requestedCurrency === 'USD' ? 'USD' : null;
  if (!normRequested) {
    return {
      allowed: false,
      error: 'Invalid currency specified. Only USD and INR are supported.',
    };
  }

  const lock = await getCustomerCurrencyLock(emailOrUserId);

  if (!lock.isLocked) {
    return { allowed: true, userId: lock.userId };
  }

  if (lock.lockedCurrency !== normRequested) {
    const currencyName = lock.lockedCurrency === 'INR' ? 'INR (₹)' : 'USD ($)';
    return {
      allowed: false,
      lockedCurrency: lock.lockedCurrency!,
      userId: lock.userId,
      error: `Your account is registered for ${currencyName} transactions for statutory tax compliance. Cross-currency checkout is not permitted.`,
    };
  }

  return {
    allowed: true,
    lockedCurrency: lock.lockedCurrency!,
    userId: lock.userId,
  };
}
