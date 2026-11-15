/**
 * Price a basket against the live catalogue, before the customer pays.
 *
 * The cart lives in the browser's localStorage and each line stores the price
 * as it was when the line was added, so a basket filled before a price change
 * keeps quoting the old figure. /api/orders/checkout already re-prices every
 * line and refuses the order with 409 PRICE_CHANGED when they disagree, which
 * stops anyone being charged the wrong amount - but it only does so after the
 * customer has filled in the form and pressed a button that said "Pay
 * Rs2,217.92". They are then told the price is wrong, having been shown a
 * total nobody intended to honour.
 *
 * This is the same check, run when the drawer opens, so the amount on the
 * button is the amount that will be accepted.
 *
 * It answers only with prices that are already public on the storefront, so it
 * needs no session - the cart works before anyone signs in. It deliberately
 * does NOT create, reserve or modify anything.
 */

import { NextRequest, NextResponse } from 'next/server';
import { repriceCart, type CartLine } from '@/lib/services/cartPricing';
import { rateLimit, clientIp } from '@/lib/security/signupGuard';

/** A basket far past this is not a shopper. */
const MAX_LINES = 50;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    // Generous: opening the drawer is an ordinary action and the catalogue is
    // cached in memory for five minutes, so this rarely reaches upstream.
    const limit = rateLimit(`reprice:${ip}`, 60, 5 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many pricing checks. Please wait a moment.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const items = body?.items;
    if (!Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'No basket was supplied.' }, { status: 400 });
    }
    if (items.length > MAX_LINES) {
      return NextResponse.json({ success: false, error: 'That basket is too large.' }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ success: true, currency: 'USD', lines: [] });
    }

    const currency = String(body?.currency || 'USD').toUpperCase() === 'INR' ? 'INR' : 'USD';

    const { checks } = await repriceCart(items as CartLine[], currency);

    // Indexed, not matched by name. repriceCart emits exactly one check per
    // line in order, so the index is exact; matching on the display name would
    // put the correction on the wrong line the first time two lines share one.
    return NextResponse.json({
      success: true,
      currency,
      lines: checks.map((c, index) => ({
        index,
        name: c.name,
        submitted: c.submitted,
        expected: c.expected,
        status: c.status,
        detail: c.detail,
      })),
    });
  } catch (err: any) {
    // The caller fails open on anything but a clean answer, so this is logged
    // rather than dressed up: a pricing check that cannot run must not stop
    // someone buying, and checkout still refuses a stale basket.
    console.error('[Cart] Re-pricing failed:', err?.message);
    return NextResponse.json(
      { success: false, error: 'Prices could not be checked right now.' },
      { status: 500 }
    );
  }
}
