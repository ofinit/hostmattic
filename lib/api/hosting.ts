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

  // Upstream plan ids are numeric and reseller-specific (6305734, 7293195 ...).
  // This used to fall back to invented strings such as 'starter_us', which no
  // catalogue contains, so a live provisioning call could only ever fail - or,
  // worse, succeed against something other than what the customer bought.
  // Resolve the real id with getSellablePlan() before calling this.
  if (!params.planId) {
    return {
      success: false,
      error:
        'No upstream plan id was supplied, so this order cannot be provisioned. ' +
        'Resolve the plan from the live catalogue before provisioning.',
    };
  }
  postData['plan-id'] = params.planId;

  switch (params.productType) {
    case 'SHARED_LINUX':
      endpoint = `/singledomainhosting/linux/${location}/add.json`;
      break;
    case 'SHARED_WINDOWS':
      endpoint = `/singledomainhosting/windows/${location}/add.json`;
      break;
    case 'WORDPRESS':
      endpoint = `/wordpresshosting/add.json`;
      break;
    case 'CLOUD':
      endpoint = `/cloudhosting/add.json`;
      break;
    case 'VPS':
      endpoint = `/vps/linux/add.json`;
      break;
    default:
      endpoint = `/singledomainhosting/linux/${location}/add.json`;
  }

  return apiClient(endpoint, postData, 'POST');
}
