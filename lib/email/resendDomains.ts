/**
 * Is the From address a domain Resend will actually send from?
 *
 * Resend refuses a send whose `from` domain is not verified, with a 403. Until
 * a domain is verified the sandbox sender reaches only the address that owns
 * the Resend account - so transactional mail to customers fails while mail to
 * the account owner succeeds.
 *
 * That combination defeats the admin console's own test button, which always
 * sends to the signed-in administrator so it cannot be used as an open relay.
 * On an unverified account that is precisely the one address that still works,
 * so the test passes while every customer email is refused. Asking Resend
 * directly is the only check that distinguishes the two.
 */

export interface ResendDomainCheck {
  /** false when the question could not be answered, not when it failed. */
  checked: boolean;
  verified?: boolean;
  /** The domain taken from the From address. */
  domain?: string;
  /** Resend's own status string, e.g. 'verified', 'pending', 'failed'. */
  status?: string;
  /** Why the check could not run, or what is wrong. */
  detail?: string;
}

/** The domain part of a bare address or a 'Name <addr@host>' envelope. */
export function domainOfFrom(from: string): string | null {
  if (!from) return null;
  const angle = from.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : from).trim();
  const at = addr.lastIndexOf('@');
  if (at < 0 || at === addr.length - 1) return null;
  return addr.slice(at + 1).trim().toLowerCase() || null;
}

export async function checkResendDomain(
  apiKey: string,
  from: string
): Promise<ResendDomainCheck> {
  const domain = domainOfFrom(from);
  if (!domain) {
    return { checked: false, detail: 'The From address has no domain to check.' };
  }
  if (!apiKey) {
    return { checked: false, domain, detail: 'No Resend API key is configured.' };
  }

  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      signal: ctl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      // "Could not check", never "the domain is bad".
      //
      // 401/403 here does NOT mean the key is broken. A Resend key restricted
      // to sending cannot list domains at all, which is the normal shape of a
      // key created for an application - so reporting it as a rejected key
      // sends an administrator off to replace a key that is working. Say what
      // is actually known: the question could not be asked.
      const restricted = res.status === 401 || res.status === 403 || res.status === 400;
      return {
        checked: false,
        domain,
        detail: restricted
          ? 'This API key cannot list domains, so the sending domain could not be checked. ' +
            'That is normal for a key restricted to sending. If mail is also failing, check ' +
            'whether the key is authorised for the domain in the From address.'
          : `Resend returned ${res.status} when listing domains.`,
      };
    }

    const body: any = await res.json().catch(() => null);
    const list: any[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];

    const match = list.find((d) => String(d?.name || '').toLowerCase() === domain);
    if (!match) {
      return {
        checked: true,
        verified: false,
        domain,
        detail:
          `${domain} is not added to this Resend account. Resend will refuse to send from it, ` +
          'except to the address that owns the account. Add and verify it at resend.com/domains.',
      };
    }

    const status = String(match.status || '').toLowerCase();
    if (status === 'verified') {
      return { checked: true, verified: true, domain, status };
    }

    return {
      checked: true,
      verified: false,
      domain,
      status,
      detail:
        `${domain} is added to Resend but its status is "${status}". Until it verifies, sends ` +
        'from this address are refused. Publish the DKIM and SPF records Resend lists for it.',
    };
  } catch (err: any) {
    return {
      checked: false,
      domain,
      detail: err?.name === 'AbortError'
        ? 'Resend did not answer in time, so the sending domain could not be checked.'
        : `Could not reach Resend to check the domain: ${err?.message || 'unknown error'}`,
    };
  }
}
