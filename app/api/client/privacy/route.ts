import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { CONSENT_PURPOSES, isWithdrawable, NOTICE_VERSION } from '@/lib/legal/consent';
import { getConsentState, withdrawConsent, grantConsent } from '@/lib/legal/consentStore';

export const dynamic = 'force-dynamic';

/**
 * The Data Principal's own controls: see what consent stands, change it, and
 * raise an access, correction or erasure request.
 *
 * Everything is scoped to the session's own user id. A privacy endpoint that
 * could be addressed by someone else's id would be a disclosure route, which
 * is the opposite of the point.
 */

function session(req: NextRequest) {
  const token = req.cookies.get('hm_auth_token')?.value;
  return token ? verifyToken(token) : null;
}

const VALID_REQUEST_TYPES = ['ACCESS', 'CORRECTION', 'ERASURE'];

export async function GET(req: NextRequest) {
  const s = session(req);
  if (!s?.id) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  const consents = await getConsentState(s.id);

  let requests: any[] = [];
  try {
    requests = await prisma.dataRequest.findMany({
      where: { userId: s.id },
      orderBy: { requestedAt: 'desc' },
      take: 20,
    });
  } catch (err: any) {
    console.warn('[privacy] Could not read data requests:', err?.message);
  }

  return NextResponse.json({
    success: true,
    noticeVersion: NOTICE_VERSION,
    purposes: CONSENT_PURPOSES.map((p) => ({
      key: p.key,
      label: p.label,
      data: p.data,
      why: p.why,
      sharedWith: p.sharedWith ?? null,
      optional: p.optional,
    })),
    consents,
    requests,
  });
}

export async function POST(req: NextRequest) {
  const s = session(req);
  if (!s?.id) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || '').trim();

  // --- Consent on or off ---------------------------------------------------
  if (action === 'set-consent') {
    const purpose = String(body?.purpose || '').trim();
    const granted = body?.granted === true;

    if (!isWithdrawable(purpose)) {
      // Required purposes are not a toggle. Saying so is more useful than a
      // generic refusal: the person is asking a reasonable question and the
      // honest answer is that this one means closing the account.
      return NextResponse.json(
        {
          success: false,
          error:
            'This use of your data is required to provide the service, so it cannot be switched ' +
            'off while the account is open. To stop it entirely, request erasure below and we will ' +
            'tell you exactly what can and cannot be removed.',
        },
        { status: 400 }
      );
    }

    const ok = granted ? await grantConsent(s.id, purpose) : await withdrawConsent(s.id, purpose);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Could not record that change. Please try again.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, consents: await getConsentState(s.id) });
  }

  // --- Access, correction or erasure --------------------------------------
  if (action === 'data-request') {
    const type = String(body?.type || '').trim().toUpperCase();
    if (!VALID_REQUEST_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: 'Unknown request type.' }, { status: 400 });
    }

    const detail = String(body?.detail || '').trim().slice(0, 2000) || null;

    try {
      // One open request of a type at a time. A second identical request does
      // not get the person an answer any sooner, and a queue of duplicates
      // makes it harder to see what is genuinely outstanding.
      const existing = await prisma.dataRequest.findFirst({
        where: { userId: s.id, type, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        select: { id: true, requestedAt: true },
      });
      if (existing) {
        return NextResponse.json({
          success: true,
          alreadyOpen: true,
          message:
            'You already have a request of this type open. We will respond to it; raising another ' +
            'will not make it faster.',
          requestId: existing.id,
        });
      }

      const created = await prisma.dataRequest.create({
        data: { userId: s.id, type, detail, status: 'OPEN' },
      });

      console.log(`[privacy] ${type} request ${created.id} raised by user ${s.id}`);

      return NextResponse.json({
        success: true,
        requestId: created.id,
        message:
          type === 'ERASURE'
            ? 'Your erasure request has been recorded. We will tell you what can be deleted and ' +
              'what we are required to keep — invoices must be retained for tax purposes, and ' +
              'registrant details held by a domain registry cannot be withdrawn while the domain ' +
              'exists.'
            : 'Your request has been recorded and we will respond to it.',
      });
    } catch (err: any) {
      console.error('[privacy] Could not record the request:', err?.message);
      return NextResponse.json(
        { success: false, error: 'Could not record your request. Please try again.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
}
