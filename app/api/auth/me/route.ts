import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

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

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.id,
        name: session.name,
        email: session.email,
        role: session.role,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false, user: null });
  }
}
