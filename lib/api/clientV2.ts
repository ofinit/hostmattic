/**
 * Upstream v2 REST transport.
 *
 * The provider runs two APIs. The legacy one - form-encoded, kebab-case,
 * credentials as query parameters against httpapi.com - is what `client.ts`
 * speaks and what every working call in this app uses. This is the other one:
 * JSON bodies, camelCase fields, credentials in headers.
 *
 * Both are kept because they are not interchangeable. Pricing, customer search
 * and domain availability are confirmed working on legacy against the live
 * account; there is no reason to move them and every reason not to. What the v2
 * specification gives us is a transfer-in endpoint with a documented required
 * field set and a pre-flight check, which is what the legacy transfer lacked.
 *
 * Credentials are the same pair, mapped as the specification's security
 * schemes define them:
 *   Authorization: ApiKey <RESELLER_API_KEY>
 *   X-User-Id:     <RESELLER_AUTH_USERID>
 *
 * Note X-User-Id is the reseller *user id*, not the api key.
 */

export interface V2Response<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  isMock?: boolean;
  /** Present on a real round trip. Lets a caller tell "not provisioned" from "rejected". */
  httpStatus?: number;
}

function getBaseUrl(): string {
  return (process.env.RESELLER_V2_BASE_URL || 'https://api.resellerclub.com/v2').replace(/\/+$/, '');
}

function getUserId(): string {
  return process.env.RESELLER_AUTH_USERID?.trim() || '';
}

function getApiKey(): string {
  return process.env.RESELLER_API_KEY?.trim() || '';
}

export const isV2Configured = (): boolean => Boolean(getUserId() && getApiKey());

/**
 * True when the response says the account cannot reach this API at all, rather
 * than that the request was wrong. Only these justify falling back to legacy;
 * a validation or business rejection is a real answer and must stand.
 */
export function isUnavailable(res: V2Response): boolean {
  return res.httpStatus === 401 || res.httpStatus === 403 || res.httpStatus === 404;
}

export async function apiV2<T = any>(
  path: string,
  opts: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    query?: Record<string, string | number | boolean | undefined | (string | number)[]>;
    body?: Record<string, any>;
  } = {}
): Promise<V2Response<T>> {
  const userId = getUserId();
  const apiKey = getApiKey();

  if (!userId || !apiKey) {
    return { success: true, isMock: true };
  }

  const url = new URL(`${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(opts.query || {})) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, String(item)));
    else url.searchParams.append(k, String(v));
  }

  const method = opts.method || 'GET';

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        // The specification is explicit that the scheme prefix is part of the
        // value, not decoration.
        Authorization: `ApiKey ${apiKey}`,
        'X-User-Id': userId,
        Accept: 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
      cache: 'no-store',
    });

    const rawText = await response.text();
    let json: any = null;
    if (rawText.trim()) {
      try {
        json = JSON.parse(rawText);
      } catch {
        return {
          success: false,
          httpStatus: response.status,
          error:
            response.status === 403
              ? 'Upstream refused the request (403). If the API key is correct, this account may not be enabled for the v2 API, or the server IP may not be whitelisted.'
              : `Unreadable response from upstream (HTTP ${response.status}).`,
        };
      }
    }

    if (!response.ok) {
      return {
        success: false,
        httpStatus: response.status,
        // GenericResponse carries `message`.
        error: json?.message || json?.error || `Upstream returned HTTP ${response.status}.`,
        data: json,
      };
    }

    // A 200 can still describe a failure. Note `error` is NOT a failure
    // indicator on its own: the specification documents it on the registration
    // response as an advisory for an accepted-but-delayed order.
    if (json?.status === 'Failed' || json?.status === 'ERROR' || json?.success === false) {
      return {
        success: false,
        httpStatus: response.status,
        error: json?.message || json?.error || 'Upstream rejected the request.',
        data: json,
      };
    }

    return { success: true, data: json, httpStatus: response.status };
  } catch (err: any) {
    console.error(`[v2 ${method} ${path}]`, err?.message || err);
    return { success: false, error: err?.message || 'Network connection to upstream failed.' };
  }
}
