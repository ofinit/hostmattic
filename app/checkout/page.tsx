'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/CartContext';
import { useCurrency } from '@/components/CurrencyContext';
import { GST_STATES, DEFAULT_SELLER_STATE_CODE } from '@/lib/constants/gstStates';
import { COUNTRIES, getCountryStates } from '@/lib/constants/countries';
import { loadRazorpaySdk } from '@/lib/utils/loadRazorpay';

export default function FullCheckoutPage() {
  const { items, addItem, removeItem, updateItemCycle, clearCart, totalUsd } = useCart();
  const { formatPrice, currency, setCurrency, setAccountLock, isLocked, lockedCurrency } = useCurrency();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'razorpay' | 'instamojo' | 'razorpay_card'>('upi');
  const [upiGateway, setUpiGateway] = useState<'razorpay' | 'instamojo'>('razorpay');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExp, setCardExp] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('888');
  const [upiId, setUpiId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [lockedCurrencyNotice, setLockedCurrencyNotice] = useState<'USD' | 'INR' | null>(null);

  // Check email for existing account currency lock
  useEffect(() => {
    if (!customerEmail || !customerEmail.includes('@') || customerEmail.length < 5) {
      setLockedCurrencyNotice(null);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/client/currency-status?email=${encodeURIComponent(customerEmail.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.success && data?.isLocked && data?.lockedCurrency) {
            setAccountLock(data.lockedCurrency);
            if (data.lockedCurrency !== currency) {
              setLockedCurrencyNotice(data.lockedCurrency);
            } else {
              setLockedCurrencyNotice(null);
            }
          } else {
            setLockedCurrencyNotice(null);
          }
        })
        .catch(() => {});
    }, 400);

    return () => clearTimeout(timer);
  }, [customerEmail, currency, setAccountLock]);

  // Billing Profile States & Country-State Mapping
  const [billingCountry, setBillingCountry] = useState(currency === 'INR' ? 'IN' : 'US');
  const [billingStateCode, setBillingStateCode] = useState(currency === 'INR' ? '32' : 'CA');
  const [customStateText, setCustomStateText] = useState('');

  // Automatically enforce method and default country according to currency
  useEffect(() => {
    if (currency === 'USD') {
      setPaymentMethod('razorpay_card');
      if (billingCountry === 'IN') {
        setBillingCountry('US');
        setBillingStateCode('CA');
      }
    } else {
      if (paymentMethod === 'razorpay_card') {
        setPaymentMethod('upi');
      }
      if (billingCountry !== 'IN') {
        setBillingCountry('IN');
        setBillingStateCode('32');
      }
    }
  }, [currency]);

  // GST & Billing Profile States
  const [taxSettings, setTaxSettings] = useState<any>(null);
  const [customerType, setCustomerType] = useState<'B2C' | 'B2B'>('B2C');
  const [companyName, setCompanyName] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [orderCompleteData, setOrderCompleteData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/tax/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.settings) {
          setTaxSettings(d.settings);
          if (d.settings.stateCode && billingCountry === 'IN') {
            setBillingStateCode(d.settings.stateCode);
          }
        }
      })
      .catch(() => {});
  }, [billingCountry]);

  // Compute dynamic country & state variables
  const isIndianBuyer = billingCountry === 'IN';
  const countryStates = getCountryStates(billingCountry);
  const selectedCountry = COUNTRIES.find((c) => c.code === billingCountry) || { code: billingCountry, name: billingCountry };

  let selectedState = { code: billingStateCode, name: billingStateCode };
  if (isIndianBuyer) {
    selectedState = GST_STATES.find((s) => s.code === billingStateCode) || { code: '32', name: 'Kerala' };
  } else if (countryStates.length > 0) {
    const matched = countryStates.find((s) => s.code === billingStateCode);
    selectedState = matched || { code: billingStateCode, name: billingStateCode };
  } else {
    selectedState = { code: 'OTHER', name: customStateText.trim() || 'International' };
  }

  const sellerStateCode = taxSettings?.stateCode || DEFAULT_SELLER_STATE_CODE;
  const isSameState = isIndianBuyer && selectedState.code === sellerStateCode;
  const gstRate = typeof taxSettings?.gstRate === 'number' ? taxSettings.gstRate : 18;

  let subtotalAmount = 0;
  let taxAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let taxType: 'CGST_SGST' | 'IGST' | 'LUT_EXPORT' | 'NONE' = 'NONE';
  let totalAmount = 0;

  if (currency === 'INR') {
    const rate = 83.5;
    subtotalAmount = Math.round(totalUsd * rate * 100) / 100;
    if (isIndianBuyer) {
      if (isSameState) {
        taxType = 'CGST_SGST';
        const halfRate = gstRate / 2;
        cgstAmount = Math.round(((subtotalAmount * halfRate) / 100) * 100) / 100;
        sgstAmount = Math.round(((subtotalAmount * halfRate) / 100) * 100) / 100;
        taxAmount = Math.round((cgstAmount + sgstAmount) * 100) / 100;
      } else {
        taxType = 'IGST';
        igstAmount = Math.round(((subtotalAmount * gstRate) / 100) * 100) / 100;
        taxAmount = igstAmount;
      }
    } else {
      // Non-Indian buyer in INR (LUT Export)
      taxType = 'LUT_EXPORT';
      taxAmount = 0;
    }
    totalAmount = Math.round((subtotalAmount + taxAmount) * 100) / 100;
  } else {
    // USD
    subtotalAmount = totalUsd;
    if (isIndianBuyer) {
      if (isSameState) {
        taxType = 'CGST_SGST';
        const halfRate = gstRate / 2;
        cgstAmount = Math.round(((subtotalAmount * halfRate) / 100) * 100) / 100;
        sgstAmount = Math.round(((subtotalAmount * halfRate) / 100) * 100) / 100;
        taxAmount = Math.round((cgstAmount + sgstAmount) * 100) / 100;
      } else {
        taxType = 'IGST';
        igstAmount = Math.round(((subtotalAmount * gstRate) / 100) * 100) / 100;
        taxAmount = igstAmount;
      }
      totalAmount = Math.round((subtotalAmount + taxAmount) * 100) / 100;
    } else {
      // International buyer in USD: 0% Zero-Rated Export under LUT
      taxType = 'LUT_EXPORT';
      taxAmount = 0;
      totalAmount = subtotalAmount;
    }
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (items.length === 0) {
      setErrorMessage('Your cart is empty. Please add a product or domain first.');
      return;
    }

    if (!customerName || !customerEmail) {
      setErrorMessage('Please provide your full name and email address.');
      return;
    }

    if (customerType === 'B2B') {
      if (!companyName.trim()) {
        setErrorMessage('Please provide your Registered Company Name for B2B billing.');
        return;
      }
      if (!customerGstin.trim() || customerGstin.trim().length < 15) {
        setErrorMessage('Please enter a valid 15-digit GSTIN for Input Tax Credit.');
        return;
      }
    }

    setLoading(true);

    try {
      const rate = currency === 'INR' ? 83.5 : 1;

      const payload = {
        items: items.map((item) => ({
          type: item.type,
          productType: item.productType || 'SERVICE',
          name: item.name,
          sacCode: '998315',
          domainName: item.domainName || (item.type === 'DOMAIN' ? item.name : undefined),
          price: (item.billingPeriod === 'annual' ? item.priceAnnual : item.priceMonthly) * rate,
          period: item.billingPeriod === 'annual' ? '1 Year' : '1 Month',
        })),
        customer: {
          name: customerName,
          email: customerEmail,
          password: password || undefined,
        },
        subtotalAmount,
        taxRate: currency === 'INR' ? gstRate : (taxType === 'LUT_EXPORT' ? 0 : gstRate),
        taxAmount,
        totalAmount,
        currency,
        customerType,
        customerGstin: customerType === 'B2B' ? customerGstin.trim().toUpperCase() : undefined,
        companyName: customerType === 'B2B' ? companyName.trim() : undefined,
        billingAddress: billingAddress.trim() || undefined,
        billingCity: billingCity.trim() || undefined,
        billingState: selectedState.name,
        billingCountry: billingCountry,
        placeOfSupply: isIndianBuyer ? `${selectedState.code}-${selectedState.name}` : `${billingCountry}-${selectedState.name}`,
        taxType,
        cgstAmount,
        sgstAmount,
        igstAmount,
        paymentMethod: paymentMethod === 'upi' ? 'UPI' : (paymentMethod === 'razorpay_card' ? 'CREDIT_CARD' : paymentMethod.toUpperCase()),
        paymentStatus: 'PENDING',
        gatewayName: (currency === 'USD' || paymentMethod === 'razorpay' || paymentMethod === 'razorpay_card' || (paymentMethod === 'upi' && upiGateway === 'razorpay'))
          ? 'RAZORPAY'
          : 'INSTAMOJO',
      };

      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        if (res.status === 409 || data.code === 'CURRENCY_LOCKED') {
          const targetCurr = (data.lockedCurrency as 'USD' | 'INR') || (currency === 'USD' ? 'INR' : 'USD');
          setLockedCurrencyNotice(targetCurr);
          setAccountLock(targetCurr);
          setErrorMessage(data.error || `Your account is registered for ${targetCurr} transactions. Please switch your cart currency to proceed.`);
        } else {
          setErrorMessage(data.error || 'Failed to initialize order. Please try again.');
        }
        setLoading(false);
        return;
      }

      const selectedGateway = payload.gatewayName;

      // 1. Instamojo Gateway Routing (INR Only)
      if (selectedGateway === 'INSTAMOJO') {
        const mojoRes = await fetch('/api/payments/instamojo/create-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: totalAmount,
            currency: 'INR',
            orderNumber: data.orderNumber,
            buyerName: customerName,
            email: customerEmail,
          }),
        });

        const mojoData = await mojoRes.json();
        if (mojoData.success && mojoData.paymentUrl) {
          clearCart();
          window.location.href = mojoData.paymentUrl;
          return;
        } else {
          setErrorMessage(mojoData.error || 'Failed to initialize Instamojo payment request.');
          setLoading(false);
          return;
        }
      }

      // 2. Razorpay Gateway Routing (INR UPI / All-in-One & USD Card)
      if (selectedGateway === 'RAZORPAY') {
        const rzpRes = await fetch('/api/payments/razorpay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: totalAmount,
            currency: currency === 'USD' ? 'USD' : 'INR',
            orderNumber: data.orderNumber,
          }),
        });

        const rzpData = await rzpRes.json();
        if (!rzpData.success) {
          setErrorMessage(rzpData.error || 'Failed to initialize Razorpay payment order.');
          setLoading(false);
          return;
        }

        // Handle Sandbox Simulation Mode (Development / Preview)
        if (rzpData.isSimulated) {
          const verifyRes = await fetch('/api/payments/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderNumber: data.orderNumber,
              razorpayOrderId: rzpData.orderId,
              razorpayPaymentId: `pay_sim_${Date.now().toString().slice(-8)}`,
              razorpaySignature: 'simulated_dev_signature',
              paymentMethod: currency === 'USD' ? 'RAZORPAY_CARD' : (paymentMethod === 'upi' ? 'RAZORPAY_UPI' : 'RAZORPAY_ONLINE'),
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            setOrderCompleteData({
              orderNumber: data.orderNumber,
              provisioned: data.provisioned || [],
              totalFormatted: currency === 'INR' ? `₹${totalAmount.toLocaleString()}` : `$${totalAmount.toFixed(2)}`,
            });
            clearCart();
          } else {
            setErrorMessage(verifyData.error || 'Payment verification failed in sandbox.');
          }
          setLoading(false);
          return;
        }

        // Live Razorpay Checkout Modal
        const sdkLoaded = await loadRazorpaySdk();
        if (!sdkLoaded) {
          setErrorMessage('Unable to load Razorpay payment SDK. Please check your internet connection.');
          setLoading(false);
          return;
        }

        const options: any = {
          key: rzpData.keyId,
          amount: rzpData.amount,
          currency: rzpData.currency,
          name: 'Hostmattic Technologies',
          description: `Order #${data.orderNumber}`,
          image: '/assets/img/hostmattic-logo-icon.png',
          order_id: rzpData.orderId,
          prefill: {
            name: customerName,
            email: customerEmail,
            method: currency === 'INR' && paymentMethod === 'upi' ? 'upi' : 'card',
            vpa: paymentMethod === 'upi' && upiId ? upiId : undefined,
          },
          theme: {
            color: '#4F7C12', // Hostmattic brand green
          },
          handler: async function (response: any) {
            setLoading(true);
            try {
              const verifyRes = await fetch('/api/payments/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderNumber: data.orderNumber,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  paymentMethod: currency === 'USD' ? 'RAZORPAY_CARD' : (paymentMethod === 'upi' ? 'RAZORPAY_UPI' : 'RAZORPAY_ONLINE'),
                }),
              });
              const verifyData = await verifyRes.json();
              if (verifyData.success) {
                setOrderCompleteData({
                  orderNumber: data.orderNumber,
                  provisioned: data.provisioned || [],
                  totalFormatted: currency === 'INR' ? `₹${totalAmount.toLocaleString()}` : `$${totalAmount.toFixed(2)}`,
                });
                clearCart();
              } else {
                setErrorMessage(verifyData.error || 'Payment verification failed.');
              }
            } catch (err: any) {
              setErrorMessage(err.message || 'Verification exception occurred.');
            } finally {
              setLoading(false);
            }
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
            },
          },
        };

        // For USD orders: enforce Card block only
        if (currency === 'USD') {
          options.config = {
            display: {
              blocks: {
                cards: {
                  name: 'Credit or Debit Card',
                  instruments: [{ method: 'card' }],
                },
              },
              sequence: ['block.cards'],
              preferences: { show_default_blocks: false },
            },
          };
        }

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during checkout.');
      setLoading(false);
    }
  };

  return (
    <div className="section" style={{ minHeight: '80vh', background: '#F8FAFC', paddingTop: '40px' }}>
      <div className="container" style={{ maxWidth: '1000px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <span className="section-tag tag-cyan">Secure Cloud Checkout</span>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0F172A', marginTop: '8px' }}>
            Complete Your Hostmattic Order
          </h1>
          <p style={{ color: '#64748B', maxWidth: '600px', margin: '0 auto' }}>
            Instant domain registration, NVMe cloud provisioning, and automatic SSL issuance.
          </p>
        </div>

        {orderCompleteData ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '48px 32px', textAlign: 'center', maxWidth: '680px', margin: '0 auto', boxShadow: 'var(--shadow-lg)' }}>
            <div className="success-badge-pulse" style={{ margin: '0 auto' }}>
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', marginTop: '20px' }}>
              Order Completed &amp; Services Provisioned!
            </h2>
            <p style={{ color: '#64748B', fontSize: '1rem', marginBottom: '32px' }}>
              Your order has been recorded and cloud resources are allocated.
            </p>

            <div className="order-receipt-card" style={{ textAlign: 'left', marginBottom: '32px' }}>
              <div className="order-receipt-row">
                <span style={{ color: '#64748B' }}>Order Reference:</span>
                <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: '1.1rem', color: '#0F172A' }}>
                  #{orderCompleteData.orderNumber}
                </span>
              </div>
              <div className="order-receipt-row">
                <span style={{ color: '#64748B' }}>Total Amount Paid:</span>
                <span style={{ fontWeight: 800, color: 'var(--brand-action-green)', fontSize: '1.2rem' }}>
                  {orderCompleteData.totalFormatted}
                </span>
              </div>
              <div className="order-receipt-row">
                <span style={{ color: '#64748B' }}>Account Owner:</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{customerEmail}</span>
              </div>
              <div className="order-receipt-row">
                <span style={{ color: '#64748B' }}>Provisioning Status:</span>
                <span className="receipt-status-pill">Active / 100% Operational</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/client/dashboard" className="btn btn-primary" style={{ padding: '14px 28px' }}>
                Access Client Dashboard →
              </Link>
              <Link href="/products" className="btn btn-outline" style={{ padding: '14px 24px' }}>
                Browse More Products
              </Link>
            </div>
          </div>
        ) : (
          <div className="checkout-page-grid">
            {/* Left: Account & Payment */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '32px', boxShadow: 'var(--shadow-sm)' }}>
              <form onSubmit={handleCheckout}>
                {/* Billing Profile & GST Compliance */}
                <div style={{ marginBottom: '24px', padding: '20px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                      1. Billing Profile &amp; GST Details
                    </h3>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', background: '#FFFFFF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      SAC: 998315 (IT &amp; Cloud Services)
                    </span>
                  </div>

                  {/* B2C vs B2B Selector */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                    <button
                      type="button"
                      onClick={() => setCustomerType('B2C')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: `1.5px solid ${customerType === 'B2C' ? 'var(--brand-action-green)' : '#CBD5E1'}`,
                        background: customerType === 'B2C' ? 'rgba(79, 124, 18, 0.08)' : '#FFFFFF',
                        color: customerType === 'B2C' ? 'var(--brand-action-green)' : '#475569',
                        fontWeight: 700,
                        fontSize: '0.86rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>👤</span>
                      <div>
                        <div>Individual / Consumer</div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748B' }}>Personal &amp; Non-GST (B2C)</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCustomerType('B2B')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: `1.5px solid ${customerType === 'B2B' ? 'var(--brand-action-green)' : '#CBD5E1'}`,
                        background: customerType === 'B2B' ? 'rgba(79, 124, 18, 0.08)' : '#FFFFFF',
                        color: customerType === 'B2B' ? 'var(--brand-action-green)' : '#475569',
                        fontWeight: 700,
                        fontSize: '0.86rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>🏢</span>
                      <div>
                        <div>Business / Company</div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748B' }}>Add GSTIN for Input Tax Credit (B2B)</div>
                      </div>
                    </button>
                  </div>

                  {/* B2B Specific Fields */}
                  {customerType === 'B2B' && (
                    <div style={{ background: '#FFFFFF', border: '1px solid #C4E58C', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                      <div className="grid-col-1-to-2" style={{ marginBottom: '10px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>Company Legal Name *</label>
                          <input
                            type="text"
                            required
                            className="form-input"
                            placeholder="e.g. Acme Cloud Corp Pvt Ltd"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>Buyer GSTIN (15-Characters) *</label>
                          <input
                            type="text"
                            required
                            maxLength={15}
                            className="form-input"
                            placeholder="e.g. 27AAPFU0939F1ZV"
                            style={{ fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                            value={customerGstin}
                            onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                          />
                        </div>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#4F7C12', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>✓</span>
                        <span>Official B2B Tax Invoice with your GSTIN will be issued for full Input Tax Credit (ITC) claim.</span>
                      </div>
                    </div>
                  )}

                  {/* Account Currency Notice Banner */}
                  {lockedCurrencyNotice && (
                    <div
                      style={{
                        background: '#FFFBEB',
                        border: '1px solid #FCD34D',
                        borderRadius: '12px',
                        padding: '16px 18px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '14px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>🔒</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#92400E' }}>
                            Account Locked to {lockedCurrencyNotice === 'INR' ? 'INR (₹)' : 'USD ($)'}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#B45309', marginTop: '2px' }}>
                            Under statutory tax regulations and ledger compliance, this customer account is permanently registered for {lockedCurrencyNotice === 'INR' ? 'INR (₹) domestic billing' : 'USD ($) export billing'}.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setCurrency(lockedCurrencyNotice);
                          setLockedCurrencyNotice(null);
                          setErrorMessage('');
                        }}
                        style={{ whiteSpace: 'nowrap', padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        Switch Cart to {lockedCurrencyNotice === 'INR' ? '₹ INR' : '$ USD'} →
                      </button>
                    </div>
                  )}

                  {/* Basic Contact Info */}
                  <div className="grid-col-1-to-2" style={{ marginBottom: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Full Name *</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. Elena Vance"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Email Address *</label>
                      <input
                        type="email"
                        required
                        className="form-input"
                        placeholder="elena@company.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Billing Street Address - Full Width */}
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Billing Street Address</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Street address, suite, or tech park"
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                    />
                  </div>

                  {/* Country & State / Place of Supply - 2 Columns */}
                  <div className="grid-col-1-to-2" style={{ marginBottom: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Country *</label>
                      <select
                        className="form-select"
                        value={billingCountry}
                        onChange={(e) => {
                          const newCountry = e.target.value;
                          setBillingCountry(newCountry);
                          const states = getCountryStates(newCountry);
                          if (newCountry === 'IN') {
                            setBillingStateCode('32');
                          } else if (states.length > 0) {
                            setBillingStateCode(states[0].code);
                          } else {
                            setBillingStateCode('OTHER');
                            setCustomStateText('');
                          }
                        }}
                        style={{ background: '#FFFFFF' }}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        {isIndianBuyer ? 'State / Place of Supply *' : 'State / Province / Region *'}
                      </label>
                      {countryStates.length > 0 ? (
                        <select
                          className="form-select"
                          value={billingStateCode}
                          onChange={(e) => setBillingStateCode(e.target.value)}
                          style={{ background: '#FFFFFF' }}
                        >
                          {countryStates.map((st) => (
                            <option key={st.code} value={st.code}>
                              {st.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Enter State / Province / Region"
                          value={customStateText}
                          onChange={(e) => setCustomStateText(e.target.value)}
                          style={{ background: '#FFFFFF' }}
                          required
                        />
                      )}
                    </div>
                  </div>

                  {/* City / Town */}
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label">City / Town</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Kochi / London / New York"
                      value={billingCity}
                      onChange={(e) => setBillingCity(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Create Client Portal Password (Optional)</label>
                    <div className="password-wrap">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-input"
                        placeholder="Create a strong password for account access"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
                  2. Select Payment Method ({currency === 'INR' ? 'INR ₹' : 'USD $'})
                </h3>

                {currency === 'INR' ? (
                  <>
                    <div className="payment-method-tabs" style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className={`payment-tab ${paymentMethod === 'upi' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('upi')}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>⚡</span>
                        <span>UPI Instant (Default)</span>
                        <span style={{ fontSize: '0.7rem', background: '#9BCB44', color: '#1B2228', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>0% FEE</span>
                      </button>
                      <button
                        type="button"
                        className={`payment-tab ${paymentMethod === 'razorpay' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('razorpay')}
                      >
                        Razorpay All-in-One
                      </button>
                      <button
                        type="button"
                        className={`payment-tab ${paymentMethod === 'instamojo' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('instamojo')}
                      >
                        Instamojo Portal
                      </button>
                    </div>

                    {paymentMethod === 'upi' && (
                      <div className="payment-card-box" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.95rem' }}>Preferred UPI Gateway:</span>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                              <input
                                type="radio"
                                name="upiGateway"
                                value="razorpay"
                                checked={upiGateway === 'razorpay'}
                                onChange={() => setUpiGateway('razorpay')}
                              />
                              Razorpay UPI
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                              <input
                                type="radio"
                                name="upiGateway"
                                value="instamojo"
                                checked={upiGateway === 'instamojo'}
                                onChange={() => setUpiGateway('instamojo')}
                              />
                              Instamojo UPI
                            </label>
                          </div>
                        </div>

                        <div className="form-group" style={{ margin: '0 0 16px 0' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', color: '#475569' }}>
                            UPI ID / VPA (Optional - Or scan QR on next screen)
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="yourname@okhdfcbank / paytm / upi"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            style={{ background: '#FFFFFF' }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '0.8rem', color: '#166534' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F0FDF4', padding: '8px 12px', borderRadius: '6px' }}>
                            <span>✓</span>
                            <span>0% Gateway Fee (Zero MDR)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F0FDF4', padding: '8px 12px', borderRadius: '6px' }}>
                            <span>✓</span>
                            <span>Google Pay, PhonePe, Paytm</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F0FDF4', padding: '8px 12px', borderRadius: '6px' }}>
                            <span>✓</span>
                            <span>Instant Automated Provisioning</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'razorpay' && (
                      <div className="payment-card-box" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#0F172A' }}>Razorpay Multi-Option Gateway</h4>
                        <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: '#64748B', lineHeight: '1.5' }}>
                          Pay securely via 50+ Indian NetBanking banks, domestic Credit/Debit cards (RuPay, Visa, MasterCard), or digital wallets.
                        </p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', background: '#EFF6FF', color: '#1E40AF', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>NetBanking</span>
                          <span style={{ fontSize: '0.75rem', background: '#EFF6FF', color: '#1E40AF', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>RuPay / Visa / Master</span>
                          <span style={{ fontSize: '0.75rem', background: '#EFF6FF', color: '#1E40AF', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>Paytm / Mobikwik</span>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'instamojo' && (
                      <div className="payment-card-box" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#0F172A' }}>Instamojo Secure Portal</h4>
                        <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: '#64748B', lineHeight: '1.5' }}>
                          You will be routed to the official Instamojo payment terminal to complete transaction via UPI QR, Indian NetBanking, or Debit/Credit cards.
                        </p>
                        <span style={{ fontSize: '0.75rem', background: '#F1F5F9', color: '#334155', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                          Secured by Instamojo India
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  /* USD Payment Method: Razorpay International Card ONLY */
                  <div className="payment-card-box" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.3rem' }}>💳</span>
                        <strong style={{ color: '#0F172A', fontSize: '1rem' }}>Razorpay International Card Gateway</strong>
                      </div>
                      <span style={{ fontSize: '0.75rem', background: '#29B4D5', color: '#0F172A', padding: '3px 8px', borderRadius: '4px', fontWeight: 800 }}>
                        USD EXCLUSIVE
                      </span>
                    </div>
                    <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748B', lineHeight: '1.5' }}>
                      International transactions are processed securely via Razorpay International Card Gateway. Supports major credit and debit card networks globally.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.75rem', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#1E293B', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>Visa</span>
                      <span style={{ fontSize: '0.75rem', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#1E293B', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>MasterCard</span>
                      <span style={{ fontSize: '0.75rem', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#1E293B', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>American Express</span>
                      <span style={{ fontSize: '0.75rem', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#1E293B', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>Discover / JCB</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#0369A1', background: '#F0F9FF', padding: '8px 12px', borderRadius: '8px' }}>
                      <span>🛡️</span>
                      <span>3D Secure 2.0 Authenticated • Zero GST (Zero-Rated Export of Services under LUT)</span>
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #F87171', color: '#B91C1C', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', marginTop: '16px' }}>
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || items.length === 0}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '1.05rem', marginTop: '24px' }}
                >
                  {loading ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <span className="spinner-inline" /> Provisioning Order with Cloud Engine...
                    </span>
                  ) : (
                    `Pay ${currency === 'INR' ? `₹${totalAmount.toLocaleString()}` : `$${totalAmount.toFixed(2)}`} & Deploy Services →`
                  )}
                </button>
              </form>
            </div>

            {/* Right: Order Summary */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Order Summary</h3>
                <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>{items.length} Items</span>
              </div>

              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748B' }}>
                  <p>Your cart is empty.</p>
                  <Link href="/products" className="btn btn-sm btn-primary" style={{ marginTop: '10px' }}>
                    Browse Products
                  </Link>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                    {items.map((item) => {
                      const activePrice = item.billingPeriod === 'annual' ? item.priceAnnual : item.priceMonthly;
                      return (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0F172A' }}>{item.name}</div>
                            {item.domainName && (
                              <div style={{ fontSize: '0.8rem', color: '#4F7C12' }}>Domain: {item.domainName}</div>
                            )}
                            {item.type !== 'DOMAIN' && (
                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                <button
                                  type="button"
                                  className={`cycle-pill-sm ${item.billingPeriod === 'monthly' ? 'active' : ''}`}
                                  onClick={() => updateItemCycle(item.id, 'monthly')}
                                >
                                  Monthly
                                </button>
                                <button
                                  type="button"
                                  className={`cycle-pill-sm ${item.billingPeriod === 'annual' ? 'active' : ''}`}
                                  onClick={() => updateItemCycle(item.id, 'annual')}
                                >
                                  Annual (-40%)
                                </button>
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: 'var(--brand-action-green)' }}>
                              {formatPrice(activePrice)}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '0.75rem', cursor: 'pointer', marginTop: '4px' }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Intelligent Upgrades & Security Add-ons */}
                  {(() => {
                    const hasSsl = items.some((i) => i.name.toLowerCase().includes('ssl'));
                    const hasBackup = items.some((i) => i.name.toLowerCase().includes('backup') || i.name.toLowerCase().includes('codeguard'));
                    const hasSecurity = items.some((i) => i.name.toLowerCase().includes('sitelock') || i.name.toLowerCase().includes('firewall'));
                    const hasEmail = items.some((i) => i.type === 'EMAIL');

                    const availableUpsells = [
                      {
                        id: 'upsell-ssl',
                        name: 'PositiveSSL Security Certificate',
                        type: 'SECURITY' as const,
                        priceMonthly: 0.99,
                        priceAnnual: 11.99,
                        badge: '94% Margin',
                        desc: 'Green padlock & 256-bit encryption',
                        condition: !hasSsl,
                      },
                      {
                        id: 'upsell-backup',
                        name: 'CodeGuard Cloud Backup',
                        type: 'SECURITY' as const,
                        priceMonthly: 1.49,
                        priceAnnual: 14.30,
                        badge: 'Recommended',
                        desc: 'Daily snapshots & 1-click restore',
                        condition: !hasBackup,
                      },
                      {
                        id: 'upsell-sitelock',
                        name: 'SiteLock Web Firewall (WAF)',
                        type: 'SECURITY' as const,
                        priceMonthly: 1.99,
                        priceAnnual: 17.90,
                        badge: 'Essential',
                        desc: 'Automated malware removal',
                        condition: !hasSecurity,
                      },
                      {
                        id: 'upsell-email',
                        name: 'Business Email Inbox (5 GB)',
                        type: 'EMAIL' as const,
                        priceMonthly: 0.99,
                        priceAnnual: 7.10,
                        badge: 'Popular',
                        desc: 'Professional custom domain email',
                        condition: !hasEmail,
                      },
                    ].filter((u) => u.condition);

                    if (availableUpsells.length === 0) return null;

                    return (
                      <div style={{ margin: '18px 0', padding: '14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>⚡ Frequently Added Upgrades</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {availableUpsells.slice(0, 2).map((opt) => (
                            <div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '0.82rem' }}>
                              <div style={{ paddingRight: '8px' }}>
                                <div style={{ fontWeight: 700, color: '#0F172A' }}>{opt.name}</div>
                                <div style={{ fontSize: '0.74rem', color: '#64748B' }}>{opt.desc}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  addItem({
                                    type: opt.type,
                                    name: opt.name,
                                    billingPeriod: 'annual',
                                    priceMonthly: opt.priceMonthly,
                                    priceAnnual: opt.priceAnnual,
                                  }, false);
                                }}
                                className="btn btn-sm btn-outline"
                                style={{ fontSize: '0.74rem', padding: '4px 10px', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--brand-action-green)', borderColor: 'var(--brand-action-green)' }}
                              >
                                + Add {formatPrice(opt.priceAnnual)}/yr
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="checkout-summary-box">
                    <div className="checkout-summary-row">
                      <span>Taxable Subtotal (Ex-GST):</span>
                      <span style={{ fontWeight: 600 }}>
                        {currency === 'INR' ? `₹${subtotalAmount.toLocaleString()}` : `$${subtotalAmount.toFixed(2)}`}
                      </span>
                    </div>

                    {isIndianBuyer ? (
                      isSameState ? (
                        <>
                          <div className="checkout-summary-row">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>Central GST (CGST {gstRate / 2}%):</span>
                            </span>
                            <span style={{ color: '#0F172A', fontWeight: 600 }}>+₹{cgstAmount.toLocaleString()}</span>
                          </div>
                          <div className="checkout-summary-row">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>State GST (SGST {gstRate / 2}%):</span>
                            </span>
                            <span style={{ color: '#0F172A', fontWeight: 600 }}>+₹{sgstAmount.toLocaleString()}</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#4F7C12', background: '#F0FDF4', padding: '4px 8px', borderRadius: '6px', marginBottom: '8px' }}>
                            📍 Place of Supply: {selectedState.name} &bull; Intra-State Supply
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="checkout-summary-row">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>Integrated GST (IGST {gstRate}%):</span>
                            </span>
                            <span style={{ color: '#0F172A', fontWeight: 600 }}>
                              {currency === 'INR' ? `+₹${igstAmount.toLocaleString()}` : `+$${taxAmount.toFixed(2)}`}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#1E40AF', background: '#EFF6FF', padding: '4px 8px', borderRadius: '6px', marginBottom: '8px' }}>
                            📍 Place of Supply: {selectedState.name} &bull; Inter-State Supply
                          </div>
                        </>
                      )
                    ) : (
                      taxType === 'LUT_EXPORT' ? (
                        <div style={{ margin: '8px 0', padding: '8px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '0.75rem', color: '#475569' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#0F172A', marginBottom: '2px' }}>
                            <span>Tax (0% Export of Services):</span>
                            <span>{currency === 'INR' ? '₹0.00' : '$0.00'}</span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                            🌍 Billing: {selectedCountry.name} &bull; Zero-Rated Export under LUT ({taxSettings?.lutNumber || 'LUT/2026-27/001'}) without payment of IGST.
                          </div>
                        </div>
                      ) : (
                        <div className="checkout-summary-row">
                          <span>Integrated GST (IGST {gstRate}%):</span>
                          <span style={{ color: '#0F172A', fontWeight: 600 }}>+${taxAmount.toFixed(2)}</span>
                        </div>
                      )
                    )}

                    <div className="checkout-summary-row total-row">
                      <span>Total Amount Payable:</span>
                      <span style={{ color: 'var(--brand-action-green)', fontSize: '1.35rem', fontWeight: 800 }}>
                        {currency === 'INR' ? `₹${totalAmount.toLocaleString()}` : `$${totalAmount.toFixed(2)}`}
                      </span>
                    </div>

                    {customerType === 'B2B' && (
                      <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(79, 124, 18, 0.08)', borderRadius: '6px', fontSize: '0.75rem', color: '#4F7C12', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🏢</span>
                        <span>B2B Tax Invoice with GSTIN {customerGstin ? `(${customerGstin})` : ''} will be generated for ITC.</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
