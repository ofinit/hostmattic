import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, signToken } from '@/lib/auth';
import { ensureDatabaseBootstrap } from '@/lib/dbBootstrap';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // Ensure database tables and baseline administrator exist
    await ensureDatabaseBootstrap();

    // Normalize email or staff username
    let normalizedEmail = email.toLowerCase().trim();
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@hostmattic.com').toLowerCase().trim();

    if (normalizedEmail === 'admin' || normalizedEmail === 'administrator' || normalizedEmail === 'root') {
      normalizedEmail = adminEmail;
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Generic error to prevent account enumeration
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    // The stored hash is the ONLY authority on whether this password is correct.
    //
    // This deliberately has no "master password" escape hatch. A previous version
    // accepted ADMIN_PASSWORD here, overwrote the stored hash with it and let the
    // request through - which made the environment variable (and the fallback
    // compiled into the source) a working backdoor for every account it named, and
    // silently reverted any password an administrator set. Accounts are created and
    // rotated out of band via `npm run admin:password`; never from a login attempt.
    const isValid = await comparePassword(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set('hm_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours — matches JWT expiry
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

