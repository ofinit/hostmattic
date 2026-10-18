import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isLiveApiConfigured } from '@/lib/api/client';
import { apiV2, isV2Configured } from '@/lib/api/clientV2';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/admin/upstream-diagnostics
 * GET /api/admin/upstream-diagnostics?domain=example.co.in
 *
 * Answers one question: is this account reachable on the upstream v2 REST API,
 * or only on the legacy HTTP API?
 *
 * It matters because the two are not interchangeable. The legacy API is what
 * every working call in this app uses - pricing, customer search, availability.
 * The v2 API is where the transfer-in endpoint is specified, with a documented
 * required field set. Transfers try v2 first and fall back to legacy, and when
 * a transfer fails there is otherwise no way to tell which path it took.
 *
 * Every probe here is read-only. Nothing is ordered, nothing is charged.
 *
 * Administrators only: it reports upstream status codes and credential shape.
 */
export async function GET(req: NextRequest) {
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  const domain = req.nextUrl.searchParams.get('domain') || 'hostmattic.com';

  const credentials = {
    legacyConfigured: isLiveApiConfigured(),
    v2Configured: isV2Configured(),
    // Never the values themselves, only that they are present and plausible.
    authUserIdPresent: Boolean(process.env.RESELLER_AUTH_USERID?.trim()),
    apiKeyPresent: Boolean(process.env.RESELLER_API_KEY?.trim()),
    v2BaseUrl: process.env.RESELLER_V2_BASE_URL || 'https://api.resellerclub.com/v2 (default)',
  };

  if (!credentials.v2Configured) {
    return NextResponse.json({
      credentials,
      verdict: 'Upstream credentials are not set, so neither API can be reached.',
    });
  }

  // validate-transfer-in is the cheapest authenticated v2 GET that exists: it
  // reports on a domain without touching an order.
  const probe = await apiV2(`/domains/${encodeURIComponent(domain)}/validate-transfer-in`);

  // A second, unrelated v2 endpoint, so a single odd answer is not mistaken
  // for the whole API being absent.
  const pending = await apiV2('/domain-transfers/pending', { query: { size: 1, page: 1 } });

  const reachable = [probe, pending].some(
    (r) => r.httpStatus !== undefined && r.httpStatus !== 401 && r.httpStatus !== 403 && r.httpStatus !== 404
  );

  const authRejected = [probe, pending].some((r) => r.httpStatus === 401 || r.httpStatus === 403);

  let verdict: string;
  if (reachable) {
    verdict =
      'The v2 API answered. Transfers will use it, with the documented required ' +
      'field set and the validate-transfer-in pre-flight.';
  } else if (authRejected) {
    verdict =
      'The v2 API rejected these credentials (401/403). Either this account is not ' +
      'enabled for v2, or the server IP is not whitelisted for it. Transfers will ' +
      'fall back to the legacy endpoint. Ask the provider to enable v2 API access, ' +
      'or confirm the IP whitelist covers it.';
  } else {
    verdict =
      'The v2 API could not be reached. Transfers will fall back to the legacy ' +
      'endpoint. See the probe statuses below.';
  }

  return NextResponse.json({
    credentials,
    probes: {
      validateTransferIn: {
        domain,
        httpStatus: probe.httpStatus ?? null,
        success: probe.success,
        error: probe.error ?? null,
        body: probe.data ?? null,
      },
      pendingTransfers: {
        httpStatus: pending.httpStatus ?? null,
        success: pending.success,
        error: pending.error ?? null,
        itemCount: Array.isArray((pending.data as any)?.transfers)
          ? (pending.data as any).transfers.length
          : null,
      },
    },
    verdict,
  });
}
