import { NextRequest, NextResponse } from 'next/server';
import { getCustomerCurrencyLock } from '@/lib/services/currencyLock';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let target = searchParams.get('email') || searchParams.get('userId');

    // If no email query param, check auth cookie
    if (!target) {
      const authCookie = req.cookies.get('hm_auth_token')?.value;
      if (authCookie) {
        const session = verifyToken(authCookie);
        if (session) {
          target = session.id || session.email;
        }
      }
    }

    if (!target) {
      return NextResponse.json({
        success: true,
        isLocked: false,
        lockedCurrency: null,
      });
    }

    const lock = await getCustomerCurrencyLock(target);

    return NextResponse.json({
      success: true,
      isLocked: lock.isLocked,
      lockedCurrency: lock.lockedCurrency,
      userId: lock.userId,
    });
  } catch (error: any) {
    console.error('Error in /api/client/currency-status:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check currency status' },
      { status: 500 }
    );
  }
}
