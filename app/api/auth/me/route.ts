import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('hm_auth_token')?.value;
    if (!token) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    // The token carries only identity. Checkout needs the billing contact to
    // prefill its form, which otherwise asks the customer to retype an address
    // the system already holds - upstream created the account with a real
    // registrant contact and the sync stores it. Returning only `phone` meant
    // the city and company already in the row never reached the form either.
    //
    // All of it is the caller's own record, selected by the session's own id,
    // so there is nothing here they are not entitled to see.
    let profile: {
      phone: string | null;
      company: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      zip: string | null;
    } | null = null;

    try {
      const record = await prisma.user.findUnique({
        where: { id: session.id },
        select: {
          phone: true,
          company: true,
          address: true,
          city: true,
          state: true,
          country: true,
          zip: true,
        },
      });
      if (record) {
        profile = {
          phone: record.phone || null,
          company: record.company || null,
          address: record.address || null,
          city: record.city || null,
          state: record.state || null,
          country: record.country || null,
          zip: record.zip || null,
        };
      }
    } catch {
      // Identity still resolves without it; the form will just ask.
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.id,
        name: session.name,
        email: session.email,
        role: session.role,
        phone: profile?.phone ?? null,
        company: profile?.company ?? null,
        address: profile?.address ?? null,
        city: profile?.city ?? null,
        state: profile?.state ?? null,
        country: profile?.country ?? null,
        zip: profile?.zip ?? null,
        impersonatedBy: session.impersonatedBy || null,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false, user: null });
  }
}
