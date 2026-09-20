'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function InstamojoSandboxContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderNumber = searchParams.get('orderNumber') || 'HM-123456';
  const amount = searchParams.get('amount') || '0';
  const paymentRequestId = searchParams.get('payment_request_id') || `imojo_${Date.now()}`;
  const [loading, setLoading] = useState(false);

  const handleAuthorize = async () => {
    setLoading(true);
    const mockPaymentId = `MOJO_${Date.now().toString().slice(-8)}_${Math.floor(1000 + Math.random() * 9000)}`;
    router.push(`/api/payments/instamojo/callback?payment_id=${mockPaymentId}&payment_status=Credit&payment_request_id=${paymentRequestId}&orderNumber=${orderNumber}`);
  };

  const handleCancel = () => {
    router.push(`/checkout?cancelled=true&orderNumber=${orderNumber}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0F172A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#F8FAFC'
    }}>
      <div style={{
        maxWidth: '460px',
        width: '100%',
        backgroundColor: '#1E293B',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: '#1A43BF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.2rem',
            color: '#fff'
          }}>
            IM
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Instamojo Payment Gateway</h2>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Sandbox / Developer Simulator</span>
          </div>
        </div>

        <div style={{ backgroundColor: '#0F172A', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: '#94A3B8' }}>
            <span>Merchant:</span>
            <strong style={{ color: '#F8FAFC' }}>Hostmattic Technologies</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: '#94A3B8' }}>
            <span>Order Number:</span>
            <strong style={{ color: '#F8FAFC' }}>#{orderNumber}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', marginTop: '10px' }}>
            <span>Total Payable (INR):</span>
            <strong style={{ color: '#9BCB44', fontSize: '1.25rem' }}>₹{Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        <div style={{ marginBottom: '24px', fontSize: '0.85rem', color: '#CBD5E1', lineHeight: '1.5' }}>
          <p style={{ margin: '0 0 10px 0' }}>
            This simulated gateway interface lets you test the complete <strong>Instamojo UPI / NetBanking</strong> payment verification loop prior to deploying production merchant keys.
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#4F7C12', backgroundColor: 'rgba(155, 203, 68, 0.1)', padding: '8px 12px', borderRadius: '8px' }}>
            <span>✓</span>
            <span>Simulates instant UPI & NetBanking credit callback.</span>
          </div>
        </div>

        <button
          onClick={handleAuthorize}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: '#4F7C12',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '12px',
            transition: 'background-color 0.2s'
          }}
        >
          {loading ? 'Authorizing Payment...' : 'Authorize Test Payment (Success)'}
        </button>

        <button
          onClick={handleCancel}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: 'transparent',
            color: '#94A3B8',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer'
          }}
        >
          Cancel & Return to Cart
        </button>
      </div>
    </div>
  );
}

export default function InstamojoSandboxPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#0F172A' }} />}>
      <InstamojoSandboxContent />
    </Suspense>
  );
}

