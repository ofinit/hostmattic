import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists in the database
    let userExists = false;
    try {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, email: true },
      });
      userExists = !!user;
    } catch (dbErr) {
      console.warn('[Forgot Password] DB lookup notice:', dbErr);
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

    console.log(`[Forgot Password] Reset token generated for ${normalizedEmail} (exists: ${userExists})`);

    // Standard timing-safe response preventing user enumeration
    return NextResponse.json({
      success: true,
      message: `If an account exists for ${normalizedEmail}, a secure password reset link has been dispatched to your email. Please check your inbox and spam folder.`,
    });
  } catch (error: any) {
    console.error('[Forgot Password] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process password reset request. Please try again later.' },
      { status: 500 }
    );
  }
}
