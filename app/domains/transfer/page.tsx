'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';
import { useCart } from '@/components/CartContext';

function DomainTransferForm() {
  const searchParams = useSearchParams();
  const [domain, setDomain] = useState('');
  const [authCode, setAuthCode] = useState('');
  const { addItem } = useCart();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const queryDomain = searchParams.get('domain');
    if (queryDomain) {
      setDomain(queryDomain);
    }
  }, [searchParams]);

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;
    setSubmitting(true);

    addItem(
      {
        type: 'DOMAIN',
        name: `Domain Transfer (${domain.trim()})`,
        domainName: domain.trim(),
        billingPeriod: 'annual',
        priceMonthly: 0.66,
        priceAnnual: 7.99,
      },
      true
    );

    setTimeout(() => {
      setSubmitting(false);
    }, 1500);
  };

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-cyan">Zero-Downtime Migration</span>
          <h1>Transfer Your Domains to Hostmattic</h1>
          <p className="lead">
            Consolidate your domain portfolio into one unified dashboard with zero downtime, automated DNS transfer, and a free 1-year renewal extension.
          </p>

          <div
            className="table-card-responsive"
            style={{
              maxWidth: '680px',
              margin: '36px auto 0',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              boxShadow: 'var(--shadow-lg)',
              textAlign: 'left',
            }}
          >
            {/* 3-Step Transfer Guide */}
            <div
              className="grid-col-1-to-3"
              style={{
                marginBottom: '28px',
                paddingBottom: '20px',
                borderBottom: '1px solid #F1F5F9',
                textAlign: 'center',
              }}
            >
              <div style={{ background: '#F8FAFC', padding: '12px 8px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-action-cyan)' }}>Step 1</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>Unlock Domain</div>
              </div>
              <div style={{ background: '#F8FAFC', padding: '12px 8px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-action-cyan)' }}>Step 2</div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>Get Auth Code</div>
              </div>
              <div style={{ background: '#EBF7D4', padding: '12px 8px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-action-green)' }}>Step 3</div>
                <div style={{ fontSize: '0.75rem', color: '#4F7C12', marginTop: '2px' }}>Instant Transfer</div>
              </div>
            </div>

            <form onSubmit={handleTransfer}>
              <div className="form-group">
                <label className="form-label">Domain Name to Transfer *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. myexistingcompany.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  required
                />
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '6px' }}>
                  Ensure your domain is unlocked at your current registrar before submitting.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">EPP / Auth / Secret Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. epp-auth-code-123"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  required
                />
                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '6px' }}>
                  Provided in your current registrar&apos;s management console (GoDaddy, Namecheap, Google Domains, etc.).
                </div>
              </div>

              <div
                style={{
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.84rem',
                  color: '#166534',
                }}
              >
                <span>🛡️</span>
                <span>
                  <strong>Guaranteed:</strong> All remaining registration time transfers with your domain, plus an additional <strong>1-year extension</strong> added for free.
                </span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem' }}
              >
                {submitting ? 'Adding Transfer to Cart...' : 'Initiate Domain Transfer →'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <EnterpriseGuarantee />
    </>
  );
}

export default function DomainTransferPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading transfer portal...</div>}>
      <DomainTransferForm />
    </Suspense>
  );
}
