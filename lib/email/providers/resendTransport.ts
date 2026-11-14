/**
 * Resend delivery over its REST API.
 *
 * Unchanged in behaviour from the original lib/email/resend.ts - the HTTP call
 * was moved here so the dispatcher can choose between providers without
 * importing the template module, which would have formed a cycle.
 */

import type { EmailPayload, EmailResult } from '@/lib/email/types';

export async function sendViaResend(
  payload: EmailPayload,
  apiKey: string,
  from: string,
  replyTo: string
): Promise<EmailResult> {
  const recipientList = Array.isArray(payload.to) ? payload.to : [payload.to];

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.from || from,
        to: recipientList,
        subject: payload.subject,
        html: payload.html,
        text: payload.text || undefined,
        reply_to: payload.replyTo || replyTo || undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[Resend API Error]', data);
      return {
        success: false,
        provider: 'RESEND',
        error: (data as any)?.message || `Resend rejected the request with status ${res.status}`,
      };
    }

    return { success: true, id: (data as any)?.id, provider: 'RESEND', simulated: false };
  } catch (err: any) {
    console.error('[Resend Network Error]', err);
    return {
      success: false,
      provider: 'RESEND',
      error: err?.message || 'Failed to reach the Resend API',
    };
  }
}
