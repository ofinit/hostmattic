import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, hashPassword, signToken } from '@/lib/auth';
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
    const initialPass = process.env.ADMIN_PASSWORD || 'Hostmattic@2026';

    if (normalizedEmail === 'admin' || normalizedEmail === 'administrator') {
      normalizedEmail = adminEmail;
    }

    // Find user in database
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Auto-seed initial administrator on first login if not found
    if (!user && normalizedEmail === adminEmail) {
      if (password === initialPass) {
        const passwordHash = await hashPassword(password);
        user = await prisma.user.create({
          data: {
            id: 'admin_root_seed',
            email: normalizedEmail,
            name: 'Hostmattic Administrator',
            passwordHash,
            role: 'ADMIN',
          },
        });
      }
    }

    if (!user) {
      // Generic error to prevent account enumeration
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    // Verify password against stored hash
    let isValid = await comparePassword(password, user.passwordHash);

    // If master admin password was entered, ensure it matches and update if needed
    if (!isValid && normalizedEmail === adminEmail && password === initialPass) {
      const passwordHash = await hashPassword(password);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, role: 'ADMIN' },
      });
      isValid = true;
    }

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

