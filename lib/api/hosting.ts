import { apiClient, isLiveApiConfigured, ApiResponse } from './client';

export interface ProvisionHostingParams {
  productType: 'SHARED_LINUX' | 'SHARED_WINDOWS' | 'WORDPRESS' | 'CLOUD' | 'RESELLER' | 'VPS' | 'DEDICATED';
  domainName: string;
  customerId: string;
  months?: number;
  location?: 'us' | 'in' | 'uk' | 'hk';
  planId?: string;
}

/**
 * Provision hosting instance via upstream provider
 */
export async function provisionHosting(params: ProvisionHostingParams): Promise<ApiResponse> {
  const months = params.months || 12;
  const location = params.location || 'us';

  if (!isLiveApiConfigured()) {
    const mockOrderId = Math.floor(10000000 + Math.random() * 90000000);
    const mockServerIp = location === 'in' ? '103.120.178.55' : '198.51.100.24';
    const mockUser = 'hm_' + params.domainName.replace(/[^a-z0-9]/g, '').slice(0, 8);

    return {
      success: true,
      data: {
        entityid: mockOrderId,
        status: 'Success',
        description: `${params.productType} order for ${params.domainName} provisioned successfully.`,
        serverIp: mockServerIp,
        cpanelUsername: mockUser,
        location: location.toUpperCase(),
      },
      isMock: true,
    };
  }

  // Map product type to upstream endpoint
  let endpoint = '';
  let postData: Record<string, any> = {
    'domain-name': params.domainName,
    'customer-id': params.customerId,
    months: months,
    'invoice-option': 'NoInvoice',
  };

  switch (params.productType) {
    case 'SHARED_LINUX':
      endpoint = `/singledomainhosting/linux/${location}/add.json`;
      postData['plan-id'] = params.planId || 'starter_us';
      break;
    case 'SHARED_WINDOWS':
      endpoint = `/singledomainhosting/windows/${location}/add.json`;
      postData['plan-id'] = params.planId || 'win_starter';
      break;
    case 'WORDPRESS':
      endpoint = `/wordpresshosting/add.json`;
      postData['plan-id'] = params.planId || 'wp_standard';
      break;
    case 'CLOUD':
      endpoint = `/cloudhosting/add.json`;
      postData['plan-id'] = params.planId || 'cloud_starter';
      break;
    case 'VPS':
      endpoint = `/vps/linux/add.json`;
      postData['plan-id'] = params.planId || 'vps_standard';
      break;
    default:
      endpoint = `/singledomainhosting/linux/${location}/add.json`;
  }

  return apiClient(endpoint, postData, 'POST');
}
