/**
 * Signup abuse controls for POST /api/auth/register.
 *
 * The public form had no protection of any kind, which is how a run of bot
 * accounts got in. They shared one tell: every address was a dotted Gmail
 * variant (nw7.4.737.3@gmail.com, m.atthe.wcq.k.qz.w.ar.d@gmail.com). Gmail
 * ignores dots and +suffixes, so a single inbox can mint unlimited "unique"
 * addresses. Canonicalising those is the cheapest effective control here.
 *
 * Turnstile is supported but optional: set TURNSTILE_SECRET_KEY and the token
 * is verified; leave it unset and the other controls still apply.
 */

export interface GuardVerdict {
  ok: boolean;
  status?: number;
  error?: string;
  reason?: string; // for logs, never shown to the visitor
}

/* ------------------------------------------------------------------ email */

const DOT_INSENSITIVE_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
]);

const PLUS_TAG_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'fastmail.com',
  'protonmail.com',
  'proton.me',
  'icloud.com',
  'yahoo.com',
]);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'temp-mail.org', 'throwawaymail.com', 'yopmail.com', 'trashmail.com',
  'sharklasers.com', 'getairmail.com', 'dispostable.com', 'maildrop.cc',
  'fakeinbox.com', 'mintemail.com', 'spamgourmet.com', 'tempr.email',
  'moakt.com', 'emailondeck.com', 'mohmal.com', 'tmpmail.org',
]);

/**
 * Canonical form of an address, used for duplicate detection only.
 * The address the customer typed is still what gets stored and emailed.
 */
export function canonicalizeEmail(raw: string): string {
  const email = (raw || '').toLowerCase().trim();
  const at = email.lastIndexOf('@');
  if (at < 1) return email;

  let local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (PLUS_TAG_DOMAINS.has(domain)) {
    const plus = local.indexOf('+');
    if (plus > 0) local = local.slice(0, plus);
  }
  if (DOT_INSENSITIVE_DOMAINS.has(domain)) {
    local = local.split('.').join('');
  }

  return `${local}@${domain}`;
}

export function isDisposableEmail(raw: string): boolean {
  const domain = (raw || '').toLowerCase().trim().split('@').pop() || '';
  return DISPOSABLE_DOMAINS.has(domain);
}

/* ------------------------------------------------------------- rate limit */

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_IP = 5;

function sweep(now: number) {
  if (buckets.size < 500) return;
  buckets.forEach((v, k) => {
    if (v.resetAt <= now) buckets.delete(k);
  });
}

/**
 * In-process limiter. Good enough for a single container; if this app is ever
 * scaled horizontally the counter should move to the database or a shared
 * cache, because each instance keeps its own map.
 */
export function rateLimit(key: string, max = MAX_PER_IP, windowMs = WINDOW_MS): GuardVerdict {
  const now = Date.now();
  sweep(now);

  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  hit.count += 1;
  if (hit.count > max) {
    const mins = Math.max(1, Math.ceil((hit.resetAt - now) / 60000));
    return {
      ok: false,
      status: 429,
      error: `Too many sign-up attempts. Try again in about ${mins} minute${mins === 1 ? '' : 's'}.`,
      reason: `rate-limit:${key}`,
    };
  }
  return { ok: true };
}

export function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get('x-forwarded-for') || '';
  return (
    fwd.split(',')[0].trim() ||
    h.get('cf-connecting-ip') ||
    h.get('x-real-ip') ||
    'unknown'
  );
}

/* --------------------------------------------------------------- turnstile */

export async function verifyTurnstile(token: string, ip: string): Promise<GuardVerdict> {
  const secret = (process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) return { ok: true }; // not configured - other controls still apply

  if (!token) {
    return { ok: false, status: 400, error: 'Please complete the verification challenge.', reason: 'turnstile:missing' };
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'unknown') body.set('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json: any = await res.json();
    if (json?.success) return { ok: true };

    return {
      ok: false,
      status: 400,
      error: 'Verification failed. Please try again.',
      reason: `turnstile:${(json?.['error-codes'] || []).join(',') || 'rejected'}`,
    };
  } catch (e: any) {
    // Never lock legitimate customers out because the verifier was unreachable.
    console.warn('[SignupGuard] Turnstile unreachable, allowing:', e?.message);
    return { ok: true };
  }
}

/* ------------------------------------------------------------- honeypot */

/**
 * A field real people never fill in. Bots that blindly complete every input
 * will, and they get a normal-looking success response so they do not retry.
 */
export function honeypotTripped(body: Record<string, unknown>): boolean {
  const v = body?.website ?? body?.companyUrl ?? body?.fax;
  return typeof v === 'string' && v.trim().length > 0;
}
