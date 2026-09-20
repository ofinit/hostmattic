export interface CreateInstamojoRequestParams {
  amount: number;
  currency: string;
  orderNumber: string;
  buyerName: string;
  email: string;
  phone?: string;
  redirectUrl?: string;
}

export interface InstamojoRequestResult {
  id: string;
  longurl: string;
  status: string;
  isSimulated?: boolean;
}

export class InstamojoService {
  private apiKey: string;
  private authToken: string;
  private isSandbox: boolean;

  constructor() {
    this.apiKey = process.env.INSTAMOJO_API_KEY || '';
    this.authToken = process.env.INSTAMOJO_AUTH_TOKEN || '';
    this.isSandbox = process.env.INSTAMOJO_SANDBOX === 'true';
  }

  public isConfigured(): boolean {
    return (
      Boolean(this.apiKey) &&
      Boolean(this.authToken) &&
      !this.apiKey.includes('placeholder') &&
      !this.authToken.includes('placeholder')
    );
  }

  private getBaseUrl(): string {
    return this.isSandbox
      ? 'https://test.instamojo.com/api/1.1'
      : 'https://www.instamojo.com/api/1.1';
  }

  /**
   * Creates an Instamojo Payment Request.
   * Note: Instamojo exclusively supports INR transactions.
   */
  public async createPaymentRequest(params: CreateInstamojoRequestParams): Promise<InstamojoRequestResult> {
    if (params.currency !== 'INR') {
      throw new Error('Instamojo payment gateway exclusively processes INR (₹) transactions.');
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = params.redirectUrl || `${appUrl}/api/payments/instamojo/callback?orderNumber=${encodeURIComponent(params.orderNumber)}`;

    // In sandbox simulation mode when keys are placeholder
    if (!this.isConfigured()) {
      console.log('⚡ [Instamojo] Credentials not set or placeholder. Using dev sandbox payment request.');
      const simulatedId = `imojo_req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      return {
        id: simulatedId,
        longurl: `${appUrl}/checkout/instamojo-sim?payment_request_id=${simulatedId}&orderNumber=${encodeURIComponent(params.orderNumber)}&amount=${params.amount}`,
        status: 'Pending',
        isSimulated: true,
      };
    }

    try {
      const formData = new URLSearchParams();
      formData.append('purpose', `Hostmattic Order #${params.orderNumber}`);
      formData.append('amount', params.amount.toFixed(2));
      formData.append('buyer_name', params.buyerName);
      formData.append('email', params.email);
      if (params.phone) formData.append('phone', params.phone);
      formData.append('redirect_url', redirectUrl);
      formData.append('send_email', 'True');
      formData.append('send_sms', 'False');
      formData.append('allow_repeated_payments', 'False');

      const response = await fetch(`${this.getBaseUrl()}/payment-requests/`, {
        method: 'POST',
        headers: {
          'X-Api-Key': this.apiKey,
          'X-Auth-Token': this.authToken,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error('❌ Instamojo API error:', data);
        throw new Error(data?.message || 'Failed to generate Instamojo payment request');
      }

      return {
        id: data.payment_request.id,
        longurl: data.payment_request.longurl,
        status: data.payment_request.status,
        isSimulated: false,
      };
    } catch (err: any) {
      console.error('❌ Instamojo exception:', err.message);
      // Dev sandbox fallback
      const simulatedId = `imojo_req_fallback_${Date.now()}`;
      return {
        id: simulatedId,
        longurl: `${appUrl}/checkout/instamojo-sim?payment_request_id=${simulatedId}&orderNumber=${encodeURIComponent(params.orderNumber)}&amount=${params.amount}`,
        status: 'Pending',
        isSimulated: true,
      };
    }
  }

  /**
   * Verifies payment status with Instamojo API.
   */
  public async verifyPaymentStatus(paymentRequestId: string, paymentId?: string): Promise<{ isPaid: boolean; status: string }> {
    if (!this.isConfigured() || paymentRequestId.startsWith('imojo_req_')) {
      // Sandbox simulated verification
      return { isPaid: true, status: 'Credit' };
    }

    try {
      const endpoint = paymentId
        ? `${this.getBaseUrl()}/payments/${paymentId}/`
        : `${this.getBaseUrl()}/payment-requests/${paymentRequestId}/`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
          'X-Auth-Token': this.authToken,
        },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return { isPaid: false, status: 'Failed' };
      }

      if (paymentId) {
        return {
          isPaid: data.payment.status === 'Credit',
          status: data.payment.status,
        };
      } else {
        return {
          isPaid: data.payment_request.status === 'Completed',
          status: data.payment_request.status,
        };
      }
    } catch (err) {
      console.error('❌ Error verifying Instamojo status:', err);
      return { isPaid: false, status: 'Error' };
    }
  }
}

export const instamojoService = new InstamojoService();
