/**
 * Shared mail types.
 *
 * These live apart from any provider so the dispatcher and the transports can
 * both import them without a cycle.
 */

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Overrides the configured envelope sender. Rarely wanted. */
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  /** True when nothing was actually sent - development only. */
  simulated?: boolean;
  error?: string;
  /** Which transport handled it, for diagnostics. */
  provider?: 'SMTP' | 'RESEND' | 'NONE';
}
