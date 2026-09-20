import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signToken } from '@/lib/auth';
import { createUpstreamCustomer } from '@/lib/api/customers';
import { ensureDatabaseBootstrap } from '@/lib/dbBootstrap';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseBootstrap();
    const body = await req.json();
    const { email, password, name, company, phone, address, city, state, country, zip } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: 'Email, password, and name are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    let upstreamCid: string | null = null;

    // Create in upstream system first
    try {
      const upstreamRes = await createUpstreamCustomer({
        username: email,
        passwd: password,
        name,
        company: company || 'Personal',
        address: address || '123 Enterprise Way',
        city: city || 'New York',
        state: state || 'NY',
        country: country || 'US',
        zipcode: zip || '10001',
        phoneNo: phone || '1234567890',
      });

      if (upstreamRes.success && upstreamRes.data?.customerId) {
        upstreamCid = upstreamRes.data.customerId;
      }
    } catch (upstreamErr: any) {
      console.warn('[Register] Upstream customer creation failed:', upstreamErr.message);
    }

    // Save in PostgreSQL — required, no fallback
    let user;
    try {
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          name,
          company,
          phone,
          address,
          city,
          state,
          country,
          zip,
          upstreamCustomerId: upstreamCid,
          role: 'CUSTOMER',
        },
      });
    } catch (dbError: any) {
      if (dbError.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'An account with this email address already exists.' },
          { status: 400 }
        );
      }
      console.error('[Register] Database error:', dbError.message);
      return NextResponse.json(
        { success: false, error: 'Registration failed. Please try again later.' },
        { status: 500 }
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
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

