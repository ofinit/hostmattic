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

    // The token carries only identity. Checkout needs the phone number to
    // prefill the gateway, which otherwise asks the customer for something we
    // already hold, so it is read from the record.
    let phone: string | null = null;
    try {
      const record = await prisma.user.findUnique({
        where: { id: session.id },
        select: { phone: true },
      });
      phone = record?.phone || null;
    } catch {
      // Identity still resolves without it; the gateway will just ask.
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.id,
        name: session.name,
        email: session.email,
        role: session.role,
        phone,
        impersonatedBy: session.impersonatedBy || null,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false, user: null });
  }
}
