import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { encryptSecret, isEncryptionAvailable, secretLast4 } from '@/lib/crypto/secrets';
import { invalidatePaymentConfig, getGatewayConfig, GatewayId } from '@/lib/services/paymentConfig';

export const dynamic = 'force-dynamic';

const GATEWAYS: { id: GatewayId; label: string; secretLabel: string; publicLabel: string; currencies: string[] }[] = [
  {
    id: 'RAZORPAY',
    label: 'Razorpay',
    publicLabel: 'Key ID',
    secretLabel: 'Key Secret',
    currencies: ['INR', 'USD'],
  },
  {
    id: 'INSTAMOJO',
    label: 'Instamojo',
    publicLabel: 'API Key',
    secretLabel: 'Auth Token',
    // Instamojo settles in rupees only; offering it for USD would fail at the
    // gateway after the customer had already committed.
    currencies: ['INR'],
  },
];

/**
 * GET /api/admin/settings/payments
 *
 * Secrets are never returned - only whether one is installed and its last four
 * characters, which is enough to confirm which key is in place without the
 * value ever leaving the server.
 */
export async function GET(req: NextRequest) {
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  try {
    const rows = await prisma.paymentGateway.findMany();
    const byId = new Map(rows.map((r) => [r.id, r]));

    const gateways = await Promise.all(
      GATEWAYS.map(async (meta) => {
        const row = byId.get(meta.id);
        const effective = await getGatewayConfig(meta.id);
        return {
          ...meta,
          enabled: row?.enabled ?? false,
          sandbox: row?.sandbox ?? true,
          publicKey: row?.publicKey ?? '',
          hasSecret: Boolean(row?.secretCipher),
          secretLast4: row?.secretLast4 ?? '',
          selectedCurrencies: row?.currencies
            ? row.currencies.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
            : meta.currencies,
          updatedAt: row?.updatedAt ?? null,
          updatedBy: row?.updatedBy ?? null,
          // What the checkout is actually using right now.
          effectiveSource: effective.source,
          effectivelyLive: effective.enabled && Boolean(effective.secret),
        };
      })
    );

    return NextResponse.json({
      success: true,
      encryptionAvailable: isEncryptionAvailable(),
      gateways,
    });
  } catch (error: any) {
    console.error('Payment settings read error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not read payment settings.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings/payments
 * { id, enabled, sandbox, publicKey, secret?, currencies[] }
 *
 * `secret` is optional: omitting it keeps the stored one, so an administrator
 * can toggle a gateway or change its currencies without re-entering the key.
 */
export async function POST(req: NextRequest) {
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '').toUpperCase() as GatewayId;

    const meta = GATEWAYS.find((g) => g.id === id);
    if (!meta) {
      return NextResponse.json({ success: false, error: 'Unknown payment gateway.' }, { status: 400 });
    }

    const enabled = body?.enabled === true;
    const sandbox = body?.sandbox !== false;
    const publicKey = String(body?.publicKey || '').trim();
    const secret = typeof body?.secret === 'string' ? body.secret.trim() : '';

    const currencies: string[] = Array.isArray(body?.currencies)
      ? body.currencies.map((c: unknown) => String(c).trim().toUpperCase()).filter(Boolean)
      : meta.currencies;

    const unsupported = currencies.filter((c) => !meta.currencies.includes(c));
    if (unsupported.length) {
      return NextResponse.json(
        {
          success: false,
          error: `${meta.label} cannot settle ${unsupported.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    const existing = await prisma.paymentGateway.findUnique({ where: { id } });

    if (enabled) {
      if (!publicKey) {
        return NextResponse.json(
          { success: false, error: `${meta.publicLabel} is required to enable ${meta.label}.` },
          { status: 400 }
        );
      }
      if (!secret && !existing?.secretCipher) {
        return NextResponse.json(
          { success: false, error: `${meta.secretLabel} is required to enable ${meta.label}.` },
          { status: 400 }
        );
      }
      if (!currencies.length) {
        return NextResponse.json(
          { success: false, error: 'Select at least one currency.' },
          { status: 400 }
        );
      }
      if (secret && !isEncryptionAvailable()) {
        return NextResponse.json(
          {
            success: false,
            error:
              'SETTINGS_ENCRYPTION_KEY is not set on this deployment, so the secret cannot be ' +
              'stored safely. Generate one with "openssl rand -hex 32" and add it before saving.',
          },
          { status: 400 }
        );
      }
    }

    // Turning off the last gateway that can serve a currency leaves customers
    // unable to pay with no visible cause. Require it to be deliberate.
    if (!enabled && body?.confirmNoGateway !== true) {
      const others = await prisma.paymentGateway.findMany({ where: { id: { not: id }, enabled: true } });
      const stranded = currencies.filter(
        (c) => !others.some((o) => o.currencies.split(',').map((x) => x.trim().toUpperCase()).includes(c))
      );
      if (stranded.length) {
        return NextResponse.json(
          {
            success: false,
            code: 'LAST_GATEWAY',
            error:
              `Disabling ${meta.label} leaves no way to take payment in ` +
              `${stranded.join(', ')}. Customers will not be able to check out. ` +
              'Send confirmNoGateway to proceed anyway.',
          },
          { status: 409 }
        );
      }
    }

    const data: Record<string, unknown> = {
      enabled,
      sandbox,
      publicKey,
      currencies: currencies.join(','),
      updatedBy: session.email,
    };

    if (secret) {
      data.secretCipher = encryptSecret(secret);
      data.secretLast4 = secretLast4(secret);
    }

    const saved = await prisma.paymentGateway.upsert({
      where: { id },
      update: data,
      create: {
        id,
        enabled,
        sandbox,
        publicKey,
        currencies: currencies.join(','),
        updatedBy: session.email,
        secretCipher: secret ? encryptSecret(secret) : '',
        secretLast4: secret ? secretLast4(secret) : '',
      },
    });

    // Take effect immediately rather than after the cache expires.
    invalidatePaymentConfig(id);

    console.log(
      `[Hostmattic] PAYMENT GATEWAY ${id} ${enabled ? 'ENABLED' : 'DISABLED'} by ${session.email}` +
        (secret ? ' (secret updated)' : '')
    );

    return NextResponse.json({
      success: true,
      message: `${meta.label} ${enabled ? 'enabled' : 'disabled'}.`,
      gateway: {
        id: saved.id,
        enabled: saved.enabled,
        sandbox: saved.sandbox,
        publicKey: saved.publicKey,
        hasSecret: Boolean(saved.secretCipher),
        secretLast4: saved.secretLast4,
      },
    });
  } catch (error: any) {
    console.error('Payment settings write error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not save payment settings.' },
      { status: 500 }
    );
  }
}
