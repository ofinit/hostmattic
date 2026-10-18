'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';
import { useCart } from '@/components/CartContext';
import { useCurrency } from '@/components/CurrencyContext';

/**
 * Longest-suffix match, so hotice.co.in prices as .co.in rather than .in.
 * Those are different products upstream with different prices.
 */
function extensionOf(domain: string, known: string[]): string | null {
  const name = domain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  let best: string | null = null;
  for (const tld of known) {
    if (name.endsWith(tld) && (!best || tld.length > best.length)) best = tld;
  }
  return best;
}

function DomainTransferForm() {
  const searchParams = useSearchParams();
  const [domain, setDomain] = useState('');
  const [authCode, setAuthCode] = useState('');
  const { addItem } = useCart();
  // The rest of the storefront prices through this; the transfer button was
  // formatting a dollar sign by hand and ignoring the selected currency.
  const { formatPrice } = useCurrency();
  const [submitting, setSubmitting] = useState(false);

  // Transfer used to be a flat $7.99 for every extension. That was roughly 11%
  // margin on a .co.in and a loss of over Rs2,000 on a .io, because upstream
  // prices transfers per extension just as it does registrations and renewals.
  const [pricing, setPricing] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/domains/pricing')
      .then(async (r) => {
        const text = await r.text();
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })
      .then((j) => {
        if (!cancelled && j?.success && j.pricing) setPricing(j.pricing);
      })
      .catch(() => {
        if (!cancelled) setPricing({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const matchedTld = pricing ? extensionOf(domain, Object.keys(pricing)) : null;
  const tldPricing = matchedTld ? pricing?.[matchedTld] : null;
  const transferUsd = Number(tldPricing?.transferUsd ?? 0);
  // The catalogue's rupee figure, before any conversion rounding.
  const transferInr = Number(tldPricing?.transferInr ?? 0);
  const canTransfer = transferUsd > 0;

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

    // Never add an item at a price we invented. Without a live transfer price
    // for this extension the sale is refused rather than guessed at.
    if (!canTransfer) {
      setSubmitting(false);
      return;
    }

    addItem(
      {
        type: 'DOMAIN',
        name: `Domain Transfer (${domain.trim()})`,
        domainName: domain.trim(),
        // The registry rejects a transfer without this, so it has to travel
        // with the order rather than being collected and thrown away.
        authCode: authCode.trim(),
        years: 1,
        billingPeriod: 'annual',
        priceMonthly: Number((transferUsd / 12).toFixed(2)),
        priceAnnual: transferUsd,
        priceAnnualInr: transferInr || undefined,
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

              {domain.trim() && pricing && !canTransfer && (
                <div
                  role="status"
                  style={{
                    background: '#FFF7ED',
                    border: '1px solid #FDBA74',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    marginBottom: '14px',
                    fontSize: '0.85rem',
                    color: '#7C2D12',
                    lineHeight: 1.55,
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '2px' }}>
                    Transfer pricing unavailable for this extension
                  </strong>
                  We cannot quote a transfer for{' '}
                  <strong>{matchedTld || domain.trim()}</strong> right now. Please contact support
                  and we will arrange it manually.
                </div>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !canTransfer}
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem' }}
              >
                {submitting
                  ? 'Adding Transfer to Cart...'
                  : canTransfer
                  ? `Transfer for ${formatPrice(transferUsd)}/yr →`
                  : 'Initiate Domain Transfer →'}
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
