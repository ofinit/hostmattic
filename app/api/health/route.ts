import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus = 'disconnected';
  let dbLatencyMs = -1;

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
    dbStatus = 'connected';
  } catch (err: any) {
    console.warn('[Health Check] Database probe failed:', err?.message);
    dbStatus = 'unreachable';
  }

  // Now that there is no fallback signing key, a missing JWT_SECRET means
  // nobody can sign in at all. That used to be a line in the logs; surfacing
  // it here turns a silent, total auth outage into something an operator can
  // see. Only ever a boolean - the key itself must never leave the process.
  const authConfigured = Boolean(process.env.JWT_SECRET);

  return NextResponse.json({
    status: dbStatus === 'connected' && authConfigured ? 'healthy' : 'degraded',
    auth: authConfigured
      ? { status: 'configured' }
      : { status: 'misconfigured', detail: 'JWT_SECRET is not set; no session can be issued or verified.' },
    timestamp: new Date().toISOString(),
    service: 'hostmattic-web',
    version: '1.0.0',
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs >= 0 ? `${dbLatencyMs}ms` : null,
    },
  });
}
