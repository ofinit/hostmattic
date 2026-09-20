'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from './CartContext';
import { useCurrency } from './CurrencyContext';
import { GST_STATES, DEFAULT_SELLER_STATE_CODE } from '@/lib/constants/gstStates';
import { loadRazorpaySdk } from '@/lib/utils/loadRazorpay';

export default function CheckoutDrawer() {
  const { items, removeItem, updateItemCycle, clearCart, isCartOpen, closeCart, totalUsd } = useCart();
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

  // Automatically enforce method according to currency
  useEffect(() => {
    if (currency === 'USD') {
      setPaymentMethod('razorpay_card');
    } else {
      if (paymentMethod === 'razorpay_card') {
        setPaymentMethod('upi');
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
  const [billingStateCode, setBillingStateCode] = useState('32'); // Default Kerala (32)

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [orderCompleteData, setOrderCompleteData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/tax/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.settings) {
          setTaxSettings(d.settings);
          if (d.settings.stateCode) {
            setBillingStateCode(d.settings.stateCode);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Compute dynamic tax variables
  const selectedState = GST_STATES.find((s) => s.code === billingStateCode) || { code: '32', name: 'Kerala' };
  const sellerStateCode = taxSettings?.stateCode || DEFAULT_SELLER_STATE_CODE;
  const isSameState = billingStateCode === sellerStateCode;
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
    // USD
    subtotalAmount = totalUsd;
    if (taxSettings?.usdGstPolicy === 'APPLY_GST') {
      taxType = 'IGST';
      igstAmount = Math.round(((subtotalAmount * gstRate) / 100) * 100) / 100;
      taxAmount = igstAmount;
      totalAmount = Math.round((subtotalAmount + taxAmount) * 100) / 100;
    } else {
      // Standard: 0% Zero-Rated Export under LUT
      taxType = 'LUT_EXPORT';
      taxAmount = 0;
      totalAmount = subtotalAmount;
    }
  }

  if (!isCartOpen) return null;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (items.length === 0) {
      setErrorMessage('Your cart is empty.');
      return;
    }

    if (!customerName || !customerEmail) {
      setErrorMessage('Please provide your name and email address for order provisioning.');
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
        billingCountry: currency === 'INR' ? 'IN' : 'US',
        placeOfSupply: `${selectedState.code}-${selectedState.name}`,
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
          setErrorMessage(mojoData.error || 'Failed to initialize Instamojo payment.');
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

        // Sandbox Simulation Mode
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
              itemsCount: items.length,
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
          setErrorMessage('Unable to load Razorpay payment SDK. Please refresh and try again.');
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
            color: '#4F7C12',
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
                  itemsCount: items.length,
                });
                clearCart();
              } else {
                setErrorMessage(verifyData.error || 'Payment verification failed.');
              }
            } catch (err: any) {
              setErrorMessage(err.message || 'Payment verification exception.');
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

  const handleResetAndClose = () => {
    setOrderCompleteData(null);
    setErrorMessage('');
    closeCart();
  };

  return (
    <div className="checkout-drawer-overlay" onClick={handleResetAndClose}>
      <div
        className="checkout-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="checkout-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="checkout-lock-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {orderCompleteData ? 'Order Confirmation' : 'Hostmattic Express Checkout'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {orderCompleteData
                  ? 'Cloud services provisioned successfully'
                  : '256-Bit SSL Encrypted Automated Cloud Provisioning'}
              </p>
            </div>
          </div>
          <button className="checkout-drawer-close" onClick={handleResetAndClose} aria-label="Close Checkout">
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="checkout-drawer-body">
          {orderCompleteData ? (
            /* ================= Success Receipt View ================= */
            <div className="order-success-view">
              <div className="success-badge-pulse">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', marginTop: '16px', marginBottom: '4px' }}>
                Payment &amp; Provisioning Complete!
              </h2>
              <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '24px' }}>
                Your services are actively deployed on the Hostmattic cloud cluster.
              </p>

              <div className="order-receipt-card">
                <div className="order-receipt-row">
                  <span style={{ color: '#64748B' }}>Order Reference:</span>
                  <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: '1rem', color: '#0F172A' }}>
                    #{orderCompleteData.orderNumber}
                  </span>
                </div>
                <div className="order-receipt-row">
                  <span style={{ color: '#64748B' }}>Total Paid:</span>
                  <span style={{ fontWeight: 800, color: 'var(--brand-action-green)', fontSize: '1.05rem' }}>
                    {orderCompleteData.totalFormatted}
                  </span>
                </div>
                <div className="order-receipt-row">
                  <span style={{ color: '#64748B' }}>Account Owner:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{customerEmail || 'Customer'}</span>
                </div>
                <div className="order-receipt-row">
                  <span style={{ color: '#64748B' }}>Status:</span>
                  <span className="receipt-status-pill">Active / Provisioned</span>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4F7C12" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Provisioned Infrastructure Details:
                </div>
                <div style={{ color: '#475569', lineHeight: 1.6 }}>
                  • <strong>Nameservers:</strong> <code>ns1.hostmattic.com</code> / <code>ns2.hostmattic.com</code><br />
                  • <strong>cPanel Gateway:</strong> Port <code>:2083</code> with automated Single Sign-On (SSO)<br />
                  • <strong>Confirmation email:</strong> Sent to <code>{customerEmail}</code>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Link
                  href="/client/dashboard"
                  onClick={handleResetAndClose}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
                >
                  Go to Client Dashboard →
                </Link>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="btn btn-outline"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            /* ================= Empty Cart View ================= */
            <div className="empty-cart-view">
              <div className="empty-cart-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
              </div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '12px 0 6px', color: '#0F172A' }}>
                Your Cart is Empty
              </h4>
              <p style={{ color: '#64748B', fontSize: '0.88rem', marginBottom: '20px' }}>
                Explore our domains, high-speed NVMe hosting, or enterprise security to get started.
              </p>
              <Link
                href="/products"
                onClick={handleResetAndClose}
                className="btn btn-primary"
                style={{ justifyContent: 'center' }}
              >
                Browse All 18 Products →
              </Link>
            </div>
          ) : (
            /* ================= Active Checkout Form ================= */
            <form onSubmit={handleCheckout}>
              {/* Order Items List */}
              <div className="checkout-section-title">
                <span>1. Selected Products &amp; Services ({items.length})</span>
                <button
                  type="button"
                  onClick={clearCart}
                  style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Clear All
                </button>
              </div>

              <div className="checkout-items-list">
                {items.map((item) => {
                  const activePrice = item.billingPeriod === 'annual' ? item.priceAnnual : item.priceMonthly;
                  return (
                    <div key={item.id} className="checkout-item-card">
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className={`checkout-type-tag tag-${item.type.toLowerCase()}`}>
                            {item.type}
                          </span>
                          <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>{item.name}</strong>
                        </div>
                        {item.domainName && (
                          <div style={{ fontSize: '0.82rem', color: '#4F7C12', fontWeight: 600 }}>
                            Target Domain: {item.domainName}
                          </div>
                        )}

                        {/* Billing Cycle Toggle */}
                        {item.type !== 'DOMAIN' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '0.8rem' }}>
                            <span style={{ color: '#64748B' }}>Cycle:</span>
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
                              Annual (Save 40%)
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right', marginLeft: '12px' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--brand-action-green)' }}>
                          {formatPrice(activePrice)}
                          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>
                            {item.billingPeriod === 'annual' ? '/yr' : '/mo'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            marginTop: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Remove item"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Customer Account & GST Details */}
              <div className="checkout-section-title" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>2. Account &amp; GST Details</span>
                <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>SAC 998315</span>
              </div>

              {/* B2C vs B2B Selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => setCustomerType('B2C')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: `1.5px solid ${customerType === 'B2C' ? 'var(--brand-action-green)' : '#CBD5E1'}`,
                    background: customerType === 'B2C' ? 'rgba(79, 124, 18, 0.08)' : '#FFFFFF',
                    color: customerType === 'B2C' ? 'var(--brand-action-green)' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div>👤 Individual (B2C)</div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#64748B' }}>Personal / Retail</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCustomerType('B2B')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: `1.5px solid ${customerType === 'B2B' ? 'var(--brand-action-green)' : '#CBD5E1'}`,
                    background: customerType === 'B2B' ? 'rgba(79, 124, 18, 0.08)' : '#FFFFFF',
                    color: customerType === 'B2B' ? 'var(--brand-action-green)' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div>🏢 Business (B2B)</div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#64748B' }}>Claim GST Credit</div>
                </button>
              </div>

              {/* B2B Specific Fields */}
              {customerType === 'B2B' && (
                <div style={{ background: '#F8FAFC', border: '1px solid #C4E58C', borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Company Legal Name *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                      placeholder="e.g. Acme Tech Solutions Pvt Ltd"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Buyer GSTIN (15 Chars) *</label>
                    <input
                      type="text"
                      required
                      maxLength={15}
                      className="form-input"
                      style={{ fontSize: '0.82rem', padding: '6px 10px', fontFamily: 'monospace', textTransform: 'uppercase' }}
                      placeholder="27AAPFU0939F1ZV"
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#4F7C12' }}>
                    ✓ Statutory B2B Tax Invoice will be generated for ITC.
                  </div>
                </div>
              )}

              {/* Account Currency Notice Banner */}
              {lockedCurrencyNotice && (
                <div
                  style={{
                    background: '#FFFBEB',
                    border: '1px solid #FCD34D',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.3rem' }}>🔒</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#92400E' }}>
                        Account Locked to {lockedCurrencyNotice === 'INR' ? 'INR (₹)' : 'USD ($)'}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#B45309', marginTop: '2px' }}>
                        Under statutory tax regulations and ledger rules, this account is permanently registered for {lockedCurrencyNotice === 'INR' ? 'INR (₹)' : 'USD ($)'}.
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
                    style={{ justifyContent: 'center', fontSize: '0.82rem', padding: '6px 12px' }}
                  >
                    Switch Cart to {lockedCurrencyNotice === 'INR' ? '₹ INR' : '$ USD'} →
                  </button>
                </div>
              )}

              <div className="checkout-form-grid">
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Alexander Wright"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder="alex@company.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>State / Place of Supply *</label>
                  <select
                    className="form-select"
                    value={billingStateCode}
                    onChange={(e) => setBillingStateCode(e.target.value)}
                    style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                  >
                    {GST_STATES.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.code} - {st.name} {st.code === sellerStateCode ? '(Home State)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Account Password (Optional)</label>
                  <div className="password-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Create a secure password"
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

              {/* Payment Method Selection */}
              <div className="checkout-section-title" style={{ marginTop: '20px' }}>
                <span>3. Payment Method ({currency === 'INR' ? 'INR ₹' : 'USD $'})</span>
              </div>

              {currency === 'INR' ? (
                <>
                  <div className="payment-method-tabs" style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      className={`payment-tab ${paymentMethod === 'upi' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('upi')}
                      style={{ fontSize: '0.8rem', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>⚡</span>
                      <span>UPI (Default)</span>
                      <span style={{ fontSize: '0.65rem', background: '#9BCB44', color: '#1B2228', padding: '1px 4px', borderRadius: '3px', fontWeight: 800 }}>0%</span>
                    </button>
                    <button
                      type="button"
                      className={`payment-tab ${paymentMethod === 'razorpay' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('razorpay')}
                      style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                    >
                      Razorpay
                    </button>
                    <button
                      type="button"
                      className={`payment-tab ${paymentMethod === 'instamojo' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('instamojo')}
                      style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                    >
                      Instamojo
                    </button>
                  </div>

                  {paymentMethod === 'upi' && (
                    <div className="payment-card-box" style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>Gateway:</span>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.78rem' }}>
                            <input
                              type="radio"
                              name="drawerUpiGateway"
                              value="razorpay"
                              checked={upiGateway === 'razorpay'}
                              onChange={() => setUpiGateway('razorpay')}
                            />
                            Razorpay
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.78rem' }}>
                            <input
                              type="radio"
                              name="drawerUpiGateway"
                              value="instamojo"
                              checked={upiGateway === 'instamojo'}
                              onChange={() => setUpiGateway('instamojo')}
                            />
                            Instamojo
                          </label>
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>UPI ID (Optional)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="yourname@upi / gpay"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                        />
                      </div>

                      <div style={{ fontSize: '0.72rem', color: '#166534', background: '#F0FDF4', padding: '6px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>✓</span>
                        <span>0% Surcharge • GPay, PhonePe, Paytm, QR</span>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'razorpay' && (
                    <div className="payment-card-box" style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px', fontSize: '0.8rem', color: '#475569' }}>
                      <strong style={{ color: '#0F172A', display: 'block', marginBottom: '4px' }}>Razorpay Indian Gateway</strong>
                      Pay securely with 50+ NetBanking banks, domestic Credit/Debit cards, or wallets.
                    </div>
                  )}

                  {paymentMethod === 'instamojo' && (
                    <div className="payment-card-box" style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px', fontSize: '0.8rem', color: '#475569' }}>
                      <strong style={{ color: '#0F172A', display: 'block', marginBottom: '4px' }}>Instamojo Secure Terminal</strong>
                      Complete payment via Instamojo with UPI, NetBanking, or Cards.
                    </div>
                  )}
                </>
              ) : (
                /* USD Mode: Razorpay International Card Only */
                <div className="payment-card-box" style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <strong style={{ color: '#0F172A', fontSize: '0.85rem' }}>💳 Razorpay International Card</strong>
                    <span style={{ fontSize: '0.65rem', background: '#29B4D5', color: '#0F172A', padding: '2px 6px', borderRadius: '3px', fontWeight: 800 }}>USD</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                    Secured by Razorpay International Gateway. Supports Visa, MasterCard, and American Express.
                  </p>
                  <div style={{ fontSize: '0.72rem', color: '#0369A1', background: '#F0F9FF', padding: '6px 8px', borderRadius: '4px' }}>
                    🛡️ 3D Secure • 0% GST (Zero-Rated Export under LUT)
                  </div>
                </div>
              )}

              {/* Order Total Breakdown */}
              <div className="checkout-summary-box" style={{ marginTop: '20px' }}>
                <div className="checkout-summary-row">
                  <span>Taxable Subtotal (Ex-GST):</span>
                  <span style={{ fontWeight: 600 }}>
                    {currency === 'INR' ? `₹${subtotalAmount.toLocaleString()}` : `$${subtotalAmount.toFixed(2)}`}
                  </span>
                </div>

                {currency === 'INR' ? (
                  isSameState ? (
                    <>
                      <div className="checkout-summary-row">
                        <span>Central GST (CGST {gstRate / 2}%):</span>
                        <span style={{ color: '#0F172A', fontWeight: 600 }}>+₹{cgstAmount.toLocaleString()}</span>
                      </div>
                      <div className="checkout-summary-row">
                        <span>State GST (SGST {gstRate / 2}%):</span>
                        <span style={{ color: '#0F172A', fontWeight: 600 }}>+₹{sgstAmount.toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#4F7C12', background: '#F0FDF4', padding: '3px 6px', borderRadius: '4px', marginBottom: '6px' }}>
                        📍 Supply: {selectedState.name} ({billingStateCode}) &bull; Intra-State
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="checkout-summary-row">
                        <span>Integrated GST (IGST {gstRate}%):</span>
                        <span style={{ color: '#0F172A', fontWeight: 600 }}>+₹{igstAmount.toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#1E40AF', background: '#EFF6FF', padding: '3px 6px', borderRadius: '4px', marginBottom: '6px' }}>
                        📍 Supply: {selectedState.name} ({billingStateCode}) &bull; Inter-State IGST
                      </div>
                    </>
                  )
                ) : (
                  taxType === 'LUT_EXPORT' ? (
                    <div style={{ margin: '6px 0', padding: '6px 8px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '0.72rem', color: '#64748B' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#0F172A' }}>
                        <span>Integrated Tax (0% Export):</span>
                        <span>$0.00</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                        📜 Supply for export under LUT ({taxSettings?.lutNumber || 'AD320324001928K'}).
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
                  <span style={{ color: 'var(--brand-action-green)', fontSize: '1.25rem', fontWeight: 800 }}>
                    {currency === 'INR' ? `₹${totalAmount.toLocaleString()}` : `$${totalAmount.toFixed(2)}`}
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div style={{ background: '#FEF2F2', border: '1px solid #F87171', color: '#B91C1C', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginTop: '14px' }}>
                  {errorMessage}
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem', marginTop: '20px' }}
              >
                {loading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <span className="spinner-inline" /> Provisioning Order with Cloud Engine...
                  </span>
                ) : (
                  `Pay ${currency === 'INR' ? `₹${totalAmount.toLocaleString()}` : `$${totalAmount.toFixed(2)}`} & Provision Services →`
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.75rem', color: '#94A3B8' }}>
                🔒 256-Bit TLS Security • 30-Day Money-Back Guarantee • Instant Auto-Activation
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
