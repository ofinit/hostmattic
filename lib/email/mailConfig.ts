/**
 * Transactional mail configuration, held in the database and editable from the
 * admin console.
 *
 * Before this, delivery was Resend only and its API key came from the
 * environment, so changing provider or rotating a key meant a redeploy. The
 * resolution order mirrors paymentConfig.ts:
 *
 *   1. the MailSetting row, when it names a provider that is actually usable
 *   2. otherwise RESEND_API_KEY from the environment, so a deployment keeps
 *      sending through the migration instead of going dark on first deploy
 *   3. otherwise unconfigured - which in production is an outage and is
 *      reported as one, never simulated
 *
 * The environment fallback is transitional and logs when used.
 */

import { prisma } from '@/lib/prisma';
import { decryptSecret, isEncryptionAvailable } from '@/lib/crypto/secrets';
import { formatFrom } from '@/lib/email/format';

export { formatFrom };

export const MAIL_SETTING_ID = 'default_mail_settings';

export type MailProvider = 'SMTP' | 'RESEND' | 'NONE';

export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  allowInvalidCert: boolean;
}

export interface MailConfig {
  provider: MailProvider;
  /** Fully-formed envelope sender, e.g. 'Hostmattic <no-reply@hostmattic.com>'. */
  from: string;
  replyTo: string;
  smtp: SmtpCredentials | null;
  resendApiKey: string;
  source: 'database' | 'environment' | 'none';
  /** Why the configuration is unusable, when it is. */
  problem?: string;
}

const CACHE_TTL_MS = 60 * 1000;
let cache: { value: MailConfig; expires: number } | null = null;

/** Called after an administrator saves, so the change takes effect at once. */
export function invalidateMailConfig(): void {
  cache = null;
}

const UNCONFIGURED: MailConfig = {
  provider: 'NONE',
  from: '',
  replyTo: '',
  smtp: null,
  resendApiKey: '',
  source: 'none',
};


function fromEnvironment(): MailConfig | null {
  const key = (process.env.RESEND_API_KEY || '').trim();
  if (!key) return null;
  return {
    provider: 'RESEND',
    from: (process.env.RESEND_FROM_EMAIL || 'Hostmattic <notifications@hostmattic.com>').trim(),
    replyTo: '',
    smtp: null,
    resendApiKey: key,
    source: 'environment',
  };
}

let warnedAboutEnvFallback = false;

export async function getMailConfig(): Promise<MailConfig> {
  if (cache && Date.now() < cache.expires) return cache.value;

  let resolved: MailConfig | null = null;

  try {
    const row = await prisma.mailSetting.findUnique({ where: { id: MAIL_SETTING_ID } });

    if (row && row.provider === 'SMTP') {
      // Each of these is a reason the configuration cannot send, and each is
      // worth naming separately - "SMTP is broken" sends an administrator
      // hunting through four fields.
      let problem: string | undefined;
      let password = '';

      if (!row.host) problem = 'No SMTP host is set.';
      else if (!row.fromEmail) problem = 'No From address is set.';
      else if (!row.passwordCipher) problem = 'No SMTP password is stored.';
      else if (!isEncryptionAvailable()) {
        problem = 'SETTINGS_ENCRYPTION_KEY is not set, so the stored SMTP password cannot be read.';
      } else {
        try {
          password = decryptSecret(row.passwordCipher);
        } catch (err: any) {
          problem =
            'The stored SMTP password could not be decrypted. SETTINGS_ENCRYPTION_KEY may have ' +
            'changed since it was saved; re-enter the password to store it under the current key.';
        }
      }

      resolved = problem
        ? { ...UNCONFIGURED, provider: 'NONE', source: 'database', problem }
        : {
            provider: 'SMTP',
            from: formatFrom(row.fromName, row.fromEmail),
            replyTo: row.replyTo || '',
            smtp: {
              host: row.host,
              port: row.port,
              secure: row.secure,
              username: row.username,
              password,
              allowInvalidCert: row.allowInvalidCert,
            },
            resendApiKey: '',
            source: 'database',
          };
    } else if (row && row.provider === 'RESEND') {
      // Resend's key still comes from the environment: it is a deploy-time
      // credential and there is no value in copying it into the database.
      const key = (process.env.RESEND_API_KEY || '').trim();
      resolved = key
        ? {
            provider: 'RESEND',
            from:
              formatFrom(row.fromName, row.fromEmail) ||
              (process.env.RESEND_FROM_EMAIL || 'Hostmattic <notifications@hostmattic.com>').trim(),
            replyTo: row.replyTo || '',
            smtp: null,
            resendApiKey: key,
            source: 'database',
          }
        : {
            ...UNCONFIGURED,
            source: 'database',
            problem: 'Resend is selected but RESEND_API_KEY is not set in the environment.',
          };
    }
  } catch (err: any) {
    // A missing table on a deployment that has not bootstrapped yet must not
    // take mail down where the environment can still carry it.
    console.warn('[Mail] Could not read mail settings:', err?.message);
  }

  if (!resolved) {
    resolved = fromEnvironment();
    if (resolved && !warnedAboutEnvFallback) {
      warnedAboutEnvFallback = true;
      console.warn(
        '[Mail] Using RESEND_API_KEY from the environment. Configure mail in the admin console ' +
          'so it can be changed without a redeploy.'
      );
    }
  }

  const value = resolved || UNCONFIGURED;
  cache = { value, expires: Date.now() + CACHE_TTL_MS };
  return value;
}

/** Whether anything can actually be sent right now. */
export async function isMailConfigured(): Promise<boolean> {
  const cfg = await getMailConfig();
  return cfg.provider !== 'NONE';
}
