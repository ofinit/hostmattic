import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMailConfig } from '@/lib/email/mailConfig';

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

  // Mail is the same class of silent, total outage: with no provider there is
  // no password reset, no receipt and no renewal reminder, and nothing says
  // so except a line in the logs.
  //
  // It deliberately does NOT feed the overall status. Mail being off is an
  // operational problem to fix in Admin → Email / SMTP, not a sign this
  // container is unhealthy, and restarting it would not help - the same
  // reasoning that makes the Docker HEALTHCHECK a liveness probe rather than
  // a readiness one. Never reports credentials, only the provider name.
  let email: { status: string; provider: string; source?: string; detail?: string };
  try {
    const cfg = await getMailConfig();
    email =
      cfg.provider === 'NONE'
        ? {
            status: 'not-configured',
            provider: 'none',
            detail:
              cfg.problem ||
              'No mail provider is configured, so password resets and receipts are not being sent.',
          }
        : { status: 'configured', provider: cfg.provider, source: cfg.source };
  } catch (err: any) {
    email = { status: 'unknown', provider: 'unknown', detail: 'Could not read mail configuration.' };
  }

  return NextResponse.json({
    status: dbStatus === 'connected' && authConfigured ? 'healthy' : 'degraded',
    auth: authConfigured
      ? { status: 'configured' }
      : { status: 'misconfigured', detail: 'JWT_SECRET is not set; no session can be issued or verified.' },
    email,
    timestamp: new Date().toISOString(),
    service: 'hostmattic-web',
    version: '1.0.0',
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs >= 0 ? `${dbLatencyMs}ms` : null,
    },
  });
}
