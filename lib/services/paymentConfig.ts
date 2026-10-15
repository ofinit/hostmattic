/**
 * Payment gateway configuration, held in the database and editable from the
 * admin console.
 *
 * Gateway keys used to come from environment variables read once at module
 * load, which meant rotating a compromised key required a redeploy and there
 * was no way to take a gateway out of service quickly.
 *
 * Resolution order per gateway:
 *   1. the PaymentGateway row, when it exists, is enabled and has a secret
 *      that can be decrypted
 *   2. otherwise the environment variables, so a deployment keeps taking
 *      payments through the migration and does not go dark on first deploy
 *   3. otherwise unconfigured, which in production means payments are refused
 *
 * The environment fallback is a transitional measure. It logs when used, so
 * the variables can be removed once the keys are entered in admin.
 */

import { prisma } from '@/lib/prisma';
import { decryptSecret, isEncryptionAvailable } from '@/lib/crypto/secrets';

export type GatewayId = 'RAZORPAY' | 'INSTAMOJO';

export interface GatewayConfig {
  id: GatewayId;
  enabled: boolean;
  sandbox: boolean;
  publicKey: string;
  secret: string;
  currencies: string[];
  /** Where the credentials came from, for diagnostics. */
  source: 'database' | 'environment' | 'none';
}

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<GatewayId, { value: GatewayConfig; expires: number }>();

/** Called after an administrator saves, so the change takes effect at once. */
export function invalidatePaymentConfig(id?: GatewayId): void {
  if (id) cache.delete(id);
  else cache.clear();
}

function unconfigured(id: GatewayId): GatewayConfig {
  return { id, enabled: false, sandbox: true, publicKey: '', secret: '', currencies: [], source: 'none' };
}

function looksPlaceholder(value: string): boolean {
  return !value || value.includes('placeholder');
}

/** The environment variables each gateway used before this existed. */
function fromEnvironment(id: GatewayId): GatewayConfig | null {
  if (id === 'RAZORPAY') {
    const publicKey = (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '').trim();
    const secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (looksPlaceholder(publicKey) || looksPlaceholder(secret)) return null;
    return {
      id,
      enabled: true,
      sandbox: publicKey.startsWith('rzp_test_'),
      publicKey,
      secret,
      currencies: ['INR', 'USD'],
      source: 'environment',
    };
  }

  const publicKey = (process.env.INSTAMOJO_API_KEY || '').trim();
  const secret = (process.env.INSTAMOJO_AUTH_TOKEN || '').trim();
  if (looksPlaceholder(publicKey) || looksPlaceholder(secret)) return null;
  return {
    id,
    enabled: true,
    sandbox: process.env.INSTAMOJO_SANDBOX === 'true',
    publicKey,
    secret,
    // Instamojo settles in rupees only.
    currencies: ['INR'],
    source: 'environment',
  };
}

export async function getGatewayConfig(id: GatewayId): Promise<GatewayConfig> {
  const hit = cache.get(id);
  if (hit && Date.now() < hit.expires) return hit.value;

  let resolved: GatewayConfig | null = null;

  try {
    const row = await prisma.paymentGateway.findUnique({ where: { id } });

    if (row?.enabled && row.publicKey && row.secretCipher) {
      if (!isEncryptionAvailable()) {
        // Keys are present but unreadable. Falling back to the environment
        // here would quietly take payments on a different key than the console
        // shows, so say so loudly and let the fallback below decide.
        console.error(
          `[PaymentConfig] ${id} is configured in the database but ` +
            'SETTINGS_ENCRYPTION_KEY is missing, so its secret cannot be read.'
        );
      } else {
        try {
          resolved = {
            id,
            enabled: true,
            sandbox: row.sandbox,
            publicKey: row.publicKey,
            secret: decryptSecret(row.secretCipher),
            currencies: row.currencies.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
            source: 'database',
          };
        } catch (err: any) {
          console.error(`[PaymentConfig] ${id} secret could not be decrypted: ${err?.message}`);
        }
      }
    } else if (row && !row.enabled) {
      // Deliberately switched off. Do NOT fall back to the environment; that
      // would make the off switch do nothing.
      const off = { ...unconfigured(id), source: 'database' as const };
      cache.set(id, { value: off, expires: Date.now() + CACHE_TTL_MS });
      return off;
    }
  } catch (dbErr: any) {
    console.warn(`[PaymentConfig] Could not read ${id} settings: ${dbErr?.message}`);
  }

  if (!resolved) {
    const env = fromEnvironment(id);
    if (env) {
      console.warn(
        `[PaymentConfig] ${id} is using environment variables. ` +
          'Enter the keys in Admin → Settings → Payments and remove them.'
      );
      resolved = env;
    }
  }

  const value = resolved || unconfigured(id);
  cache.set(id, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Gateways that may be offered for a given currency right now. */
export async function getAvailableGateways(currency: string): Promise<GatewayId[]> {
  const wanted = currency.toUpperCase();
  const ids: GatewayId[] = ['RAZORPAY', 'INSTAMOJO'];
  const configs = await Promise.all(ids.map(getGatewayConfig));
  return configs
    .filter((c) => c.enabled && c.secret && c.currencies.includes(wanted))
    .map((c) => c.id);
}
