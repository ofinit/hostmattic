/**
 * Hostmattic Upstream Provisioning Client
 * Handles authenticated communication with upstream cloud & domain infrastructure.
 * Automatically provides reliable simulated fallback if partner API credentials are not yet set.
 */

function getBaseUrl(): string {
  return process.env.RESELLER_API_BASE_URL || 'https://httpapi.com/api';
}

function getAuthUserId(): string {
  return process.env.RESELLER_AUTH_USERID?.trim() || '';
}

function getApiKey(): string {
  return process.env.RESELLER_API_KEY?.trim() || '';
}

export const isLiveApiConfigured = (): boolean => {
  return Boolean(getAuthUserId() && getApiKey());
};

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  isMock?: boolean;
}

/**
 * Execute HTTP GET or POST against upstream provisioning API
 */
export async function apiClient<T = any>(
  endpoint: string,
  params: Record<string, string | number | boolean> = {},
  method: 'GET' | 'POST' = 'GET'
): Promise<ApiResponse<T>> {
  const authUserId = getAuthUserId();
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();

  if (!authUserId || !apiKey) {
    // Graceful fallback for staging / development prior to API key assignment
    return {
      success: true,
      isMock: true,
    };
  }

  const url = new URL(`${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`);

  const authParams = {
    'auth-userid': authUserId,
    'api-key': apiKey,
    ...params,
  };

  try {
    let response: Response;

    if (method === 'GET') {
      Object.entries(authParams).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          v.forEach((item) => url.searchParams.append(k, String(item)));
        } else {
          url.searchParams.append(k, String(v));
        }
      });
      response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HostmatticGateway/1.0',
        },
        cache: 'no-store',
      });
    } else {
      const formData = new URLSearchParams();
      Object.entries(authParams).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          v.forEach((item) => formData.append(k, String(item)));
        } else {
          formData.append(k, String(v));
        }
      });
      response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HostmatticGateway/1.0',
        },
        body: formData.toString(),
        cache: 'no-store',
      });
    }

    const rawText = await response.text();
    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch {
      if (response.status === 403 || rawText.includes('Cloudflare') || rawText.includes('Attention Required')) {
        return {
          success: false,
          error: 'Upstream gateway returned 403 Forbidden (Cloudflare security challenge). IP whitelist propagation typically takes 15–30 minutes to activate.',
          isMock: false,
        };
      }
      return {
        success: false,
        error: `Invalid response from upstream provider (HTTP ${response.status})`,
        isMock: false,
      };
    }

    if (!response.ok || json.status === 'ERROR' || json.status === 'Failed') {
      return {
        success: false,
        error: json.message || json.error || 'Upstream provider returned an error',
        data: json,
        isMock: false,
      };
    }

    return {
      success: true,
      data: json,
      isMock: false,
    };
  } catch (err: any) {
    console.error(`[API Client Error] ${endpoint}:`, err);
    return {
      success: false,
      error: err.message || 'Network connection to provisioning gateway failed',
      isMock: false,
    };
  }
}
