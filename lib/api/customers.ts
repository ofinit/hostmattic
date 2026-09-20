import { apiClient, isLiveApiConfigured, ApiResponse } from './client';

export interface CustomerSignupData {
  username: string; // Email
  passwd: string;
  name: string;
  company?: string;
  address: string;
  city: string;
  state: string;
  country: string; // 2-letter ISO code e.g. "US", "IN"
  zipcode: string;
  phoneNo: string;
}

/**
 * Register a customer in the upstream provisioning system
 */
export async function createUpstreamCustomer(data: CustomerSignupData): Promise<ApiResponse<{ customerId: string }>> {
  if (!isLiveApiConfigured()) {
    return {
      success: true,
      data: { customerId: String(Math.floor(1000000 + Math.random() * 9000000)) },
      isMock: true,
    };
  }

  const postData: Record<string, any> = {
    username: data.username,
    passwd: data.passwd,
    name: data.name,
    company: data.company || 'Personal',
    'address-line-1': data.address,
    city: data.city,
    state: data.state,
    country: data.country,
    zipcode: data.zipcode,
    'phone-cc': data.country === 'IN' ? '91' : '1',
    'phone-num': data.phoneNo.replace(/[^0-9]/g, '').slice(-10),
    'lang-pref': 'en',
  };

  const res = await apiClient<any>('/customers/v2/signup.json', postData, 'POST');

  if (res.success && res.data) {
    const cid = String(res.data);
    return { success: true, data: { customerId: cid } };
  }

  return { success: false, error: res.error || 'Failed to create upstream customer' };
}

/**
 * Generate a secure Single-Sign-On login token for a client
 */
export async function generateCustomerSsoToken(customerId: string, ip: string = '223.185.26.53'): Promise<ApiResponse<{ token: string; redirectUrl: string }>> {
  if (!isLiveApiConfigured()) {
    const mockToken = 'mock_sso_' + Math.random().toString(36).substring(2);
    return {
      success: true,
      data: {
        token: mockToken,
        redirectUrl: `https://hostmattic.myorderbox.com/servlet/AutoLoginServlet?userLoginId=${mockToken}&role=customer`,
      },
      isMock: true,
    };
  }

  const res = await apiClient<string>(
    '/customers/generate-login-token.json',
    {
      'customer-id': customerId,
      ip: ip || '223.185.26.53',
    },
    'GET'
  );

  if (res.success && res.data) {
    const token = typeof res.data === 'string' ? res.data.replace(/"/g, '').trim() : String(res.data).trim();
    return {
      success: true,
      data: {
        token,
        redirectUrl: `https://hostmattic.myorderbox.com/servlet/AutoLoginServlet?userLoginId=${token}&role=customer`,
      },
    };
  }

  return { success: false, error: res.error || 'Could not generate SSO token' };
}
