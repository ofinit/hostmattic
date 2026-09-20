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

  return NextResponse.json({
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'hostmattic-web',
    version: '1.0.0',
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs >= 0 ? `${dbLatencyMs}ms` : null,
    },
  });
}
