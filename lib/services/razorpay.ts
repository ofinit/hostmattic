import crypto from 'crypto';
import { getGatewayConfig } from './paymentConfig';

export interface CreateRazorpayOrderParams {
  amount: number; // in normal currency units (e.g. 1599.00 or 19.99)
  currency: 'INR' | 'USD';
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number; // in subunits (paise or cents)
  currency: string;
  receipt: string;
  status: string;
  isSimulated?: boolean;
}

export class RazorpayService {
  // Credentials are resolved per call from paymentConfig, which reads the
  // PaymentGateway row and falls back to the environment. They used to be read
  // once in the constructor, so rotating a compromised key or switching the
  // gateway off needed a redeploy.
  private async config() {
    return getGatewayConfig('RAZORPAY');
  }

  public async isConfigured(): Promise<boolean> {
    const c = await this.config();
    return (
      c.enabled &&
      Boolean(c.publicKey) &&
      Boolean(c.secret) &&
      !c.publicKey.includes('placeholder') &&
      !c.secret.includes('placeholder')
    );
  }

  public async getKeyId(): Promise<string> {
    const c = await this.config();
    return c.publicKey || 'rzp_test_simulated_key';
  }

  /**
   * Creates an order with Razorpay Orders API.
   * Converts INR to Paise and USD to Cents.
   */
  public async createOrder(params: CreateRazorpayOrderParams): Promise<RazorpayOrderResult> {
    const subunits = Math.round(params.amount * 100);

    // If live/test credentials are NOT set or placeholder, return a sandbox simulation order
    if (!(await this.isConfigured())) {
      if (process.env.NODE_ENV === 'production') {
        // A live deployment with no usable gateway must refuse the payment
        // rather than hand back an order id nothing can settle.
        throw new Error('No payment gateway is configured. Please contact support.');
      }
      console.log('⚡ [Razorpay] Credentials not set or placeholder. Using dev sandbox order.');
      return {
        id: `order_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        amount: subunits,
        currency: params.currency,
        receipt: params.receipt,
        status: 'created',
        isSimulated: true,
      };
    }

    try {
      const { publicKey, secret } = await this.config();
      const basicAuth = Buffer.from(`${publicKey}:${secret}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify({
          amount: subunits,
          currency: params.currency,
          receipt: params.receipt,
          notes: params.notes || {},
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Razorpay Orders API error:', errorData);
        throw new Error(errorData?.error?.description || 'Failed to create Razorpay order');
      }

      const orderData = await response.json();
      return {
        id: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        receipt: orderData.receipt,
        status: orderData.status,
        isSimulated: false,
      };
    } catch (err: any) {
      console.error('❌ Razorpay Order creation exception:', err.message);
      if (process.env.NODE_ENV === 'production') {
        // Returning a simulated order here handed the customer an id that no
        // gateway would ever settle.
        throw err;
      }
      // Fallback in dev/preview environments to prevent checkout block
      return {
        id: `order_sim_err_${Date.now()}`,
        amount: subunits,
        currency: params.currency,
        receipt: params.receipt,
        status: 'created',
        isSimulated: true,
      };
    }
  }

  /**
   * Verifies the cryptographic HMAC SHA-256 signature returned by Razorpay Checkout.
   */
  /**
   * Whether unverified "simulated" payments may be accepted at all.
   *
   * Only when the gateway is genuinely not configured AND we are not in
   * production. A live deployment with missing keys must refuse payments, not
   * wave them through.
   */
  public async isSimulationAllowed(): Promise<boolean> {
    return !(await this.isConfigured()) && process.env.NODE_ENV !== 'production';
  }

  public async verifySignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): Promise<boolean> {
    // The caller must never be able to select simulation. This previously
    // returned true for any orderId beginning with `order_sim_`, and that value
    // arrives in the request body - so any signed-in customer could mark an
    // order PAID by inventing one. Simulation is now decided solely by this
    // server's own configuration.
    if (await this.isConfigured()) {
      const { secret } = await this.config();
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      return expectedSignature === signature;
    }

    return this.isSimulationAllowed();
  }
}

export const razorpayService = new RazorpayService();
