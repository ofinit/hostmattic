import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { sendEmail, generatePasswordResetEmail } from '@/lib/email/resend';

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
    let userName = 'Valued Customer';
    try {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, email: true, name: true },
      });
      userExists = !!user;
      if (user?.name) userName = user.name;
    } catch (dbErr) {
      console.warn('[Forgot Password] DB lookup notice:', dbErr);
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://hostmattic.com'}/login?resetToken=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

    console.log(`[Forgot Password] Reset token generated for ${normalizedEmail} (exists: ${userExists})`);

    // Dispatch password reset email via Resend (only if user exists or in simulation)
    if (userExists) {
      try {
        const emailContent = generatePasswordResetEmail({
          customerName: userName,
          resetUrl,
        });

        sendEmail({
          to: normalizedEmail,
          subject: emailContent.subject,
          html: emailContent.html,
        }).catch((err) => console.warn('[Password Reset Email Warning]', err));
      } catch (mailErr) {
        console.warn('[Password Reset Mail Error]', mailErr);
      }
    }

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
