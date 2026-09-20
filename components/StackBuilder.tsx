'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from './CurrencyContext';
import { useCart } from './CartContext';

const DEFAULT_TLD_OPTIONS = [
  { ext: '.com', defaultUsd: 13.16 },
  { ext: '.in', defaultUsd: 9.33 },
  { ext: '.tech', defaultUsd: 12.24 },
  { ext: '.online', defaultUsd: 8.81 },
  { ext: '.io', defaultUsd: 49.99 },
];

export default function StackBuilder() {
  const { formatPrice, currency } = useCurrency();

  // Selections
  const [domainTld, setDomainTld] = useState('.com');
  const [domainPrice, setDomainPrice] = useState(13.16);
  const [pricingData, setPricingData] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch('/api/domains/pricing')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.pricing) {
          setPricingData(d.pricing);
          if (d.pricing['.com']) {
            setDomainPrice(d.pricing['.com'].retailUsd);
          }
        }
      })
      .catch(() => {});
  }, []);

  const [hostingPlan, setHostingPlan] = useState('cloud');
  const [hostingPrice, setHostingPrice] = useState(6.99);

  const [sslEnabled, setSslEnabled] = useState(true);
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [securityShield, setSecurityShield] = useState(false);

  const [emailBoxes, setEmailBoxes] = useState(3);

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);

  // Compute monthly base
  const monthlyHosting = hostingPrice;
  const monthlySsl = sslEnabled ? 0.99 : 0;
  const monthlyBackup = backupEnabled ? 1.49 : 0;
  const monthlyShield = securityShield ? 1.99 : 0;
  const monthlyEmail = emailBoxes * 0.99;

  const totalMonthlyBase = monthlyHosting + monthlySsl + monthlyBackup + monthlyShield + monthlyEmail;
  const discountMultiplier = billingCycle === 'annual' ? 0.6 : 1.0; // 40% discount on annual
  const effectiveMonthly = totalMonthlyBase * discountMultiplier;
  const annualTotal = (effectiveMonthly * 12) + domainPrice;

  const { addItem, openCart } = useCart();

  const handleCheckout = () => {
    // Add domain
    addItem({
      type: 'DOMAIN',
      name: `Custom Domain (${domainTld})`,
      domainName: `my-business-stack${domainTld}`,
      billingPeriod: 'annual',
      priceMonthly: Number((domainPrice / 12).toFixed(2)),
      priceAnnual: domainPrice,
    }, false);

    // Add hosting compute
    addItem({
      type: 'HOSTING',
      productType: 'CLOUD',
      name: `Scalable Cloud NVMe (${hostingPlan.toUpperCase()})`,
      billingPeriod: billingCycle,
      priceMonthly: monthlyHosting,
      priceAnnual: Number((monthlyHosting * 0.6 * 12).toFixed(2)),
    }, false);

    // Add optional addons
    if (sslEnabled) {
      addItem({
        type: 'SECURITY',
        name: 'PositiveSSL Security Certificate',
        billingPeriod: billingCycle,
        priceMonthly: 0.99,
        priceAnnual: Number((0.99 * 0.6 * 12).toFixed(2)),
      }, false);
    }

    if (backupEnabled) {
      addItem({
        type: 'SECURITY',
        name: 'CodeGuard Automated Daily Backups',
        billingPeriod: billingCycle,
        priceMonthly: 1.49,
        priceAnnual: Number((1.49 * 0.6 * 12).toFixed(2)),
      }, false);
    }

    if (securityShield) {
      addItem({
        type: 'SECURITY',
        name: 'SiteLock Web Application Firewall (WAF)',
        billingPeriod: billingCycle,
        priceMonthly: 1.99,
        priceAnnual: Number((1.99 * 0.6 * 12).toFixed(2)),
      }, false);
    }

    if (emailBoxes > 0) {
      addItem({
        type: 'EMAIL',
        name: `Business Email (${emailBoxes} Dedicated Inboxes)`,
        billingPeriod: billingCycle,
        priceMonthly: monthlyEmail,
        priceAnnual: Number((monthlyEmail * 0.6 * 12).toFixed(2)),
      }, false);
    }

    openCart();
  };

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '36px', boxShadow: '0 20px 40px -15px rgba(15,23,42,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '1px solid #F1F5F9', paddingBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <span className="section-tag tag-cyan" style={{ marginBottom: '8px' }}>Interactive Configurator</span>
          <h3 style={{ fontSize: '1.45rem', color: '#0F172A', margin: 0 }}>Configure Your Complete Business Stack</h3>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: '4px' }}>Bundle domain, cloud infrastructure, email, and security with instant multi-service provisioning.</p>
        </div>

        {/* Billing cycle pill */}
        <div style={{ display: 'inline-flex', background: '#F1F5F9', padding: '4px', borderRadius: '999px', border: '1px solid #CBD5E1' }}>
          <button
            onClick={() => setBillingCycle('annual')}
            style={{
              padding: '6px 16px',
              borderRadius: '999px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: billingCycle === 'annual' ? 'var(--brand-action-green)' : 'none',
              color: billingCycle === 'annual' ? '#FFFFFF' : '#64748B',
              transition: 'all 0.15s ease',
            }}
          >
            Annual (Save 40%)
          </button>
          <button
            onClick={() => setBillingCycle('monthly')}
            style={{
              padding: '6px 16px',
              borderRadius: '999px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: billingCycle === 'monthly' ? 'var(--brand-action-green)' : 'none',
              color: billingCycle === 'monthly' ? '#FFFFFF' : '#64748B',
              transition: 'all 0.15s ease',
            }}
          >
            Monthly
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Step 1: Domain TLD */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
            1. Preferred TLD
          </label>
          <select
            className="form-select"
            value={domainTld}
            onChange={(e) => {
              const tld = e.target.value;
              setDomainTld(tld);
              const opt = DEFAULT_TLD_OPTIONS.find((o) => o.ext === tld);
              const live = pricingData[tld];
              setDomainPrice(live?.retailUsd || opt?.defaultUsd || 13.16);
            }}
          >
            {DEFAULT_TLD_OPTIONS.map((opt) => {
              const live = pricingData[opt.ext];
              const p = live?.retailUsd || opt.defaultUsd;
              const promoBadge = live?.isPromo && live?.badge ? ` (${live.badge})` : '';
              return (
                <option key={opt.ext} value={opt.ext}>
                  {opt.ext} — {formatPrice(p)}/yr{promoBadge}
                </option>
              );
            })}
          </select>
          <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748B', marginTop: '8px' }}>Free DNS &amp; Privacy included</span>
        </div>

        {/* Step 2: Hosting Tier */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
            2. Cloud Compute Tier
          </label>
          <select
            className="form-select"
            value={hostingPlan}
            onChange={(e) => {
              const p = e.target.value;
              setHostingPlan(p);
              if (p === 'shared') setHostingPrice(2.49);
              else if (p === 'cloud') setHostingPrice(6.99);
              else if (p === 'vps') setHostingPrice(16.99);
            }}
          >
            <option value="shared">Linux cPanel Starter — {formatPrice(2.49)}/mo</option>
            <option value="cloud">Scalable Cloud NVMe — {formatPrice(6.99)}/mo</option>
            <option value="vps">Linux KVM VPS (2 vCPU) — {formatPrice(16.99)}/mo</option>
          </select>
          <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748B', marginTop: '8px' }}>cPanel &amp; Softaculous pre-configured</span>
        </div>

        {/* Step 3: Security Pack */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
            3. Security &amp; Continuity
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <label className="form-checkbox-label">
              <input type="checkbox" checked={sslEnabled} onChange={(e) => setSslEnabled(e.target.checked)} style={{ accentColor: 'var(--brand-action-green)', width: '16px', height: '16px' }} />
              PositiveSSL Certificate (+{formatPrice(0.99)}/mo)
            </label>
            <label className="form-checkbox-label">
              <input type="checkbox" checked={backupEnabled} onChange={(e) => setBackupEnabled(e.target.checked)} style={{ accentColor: 'var(--brand-action-green)', width: '16px', height: '16px' }} />
              CodeGuard Cloud Backups (+{formatPrice(1.49)}/mo)
            </label>
            <label className="form-checkbox-label">
              <input type="checkbox" checked={securityShield} onChange={(e) => setSecurityShield(e.target.checked)} style={{ accentColor: 'var(--brand-action-green)', width: '16px', height: '16px' }} />
              SiteLock WAF Protection (+{formatPrice(1.99)}/mo)
            </label>
          </div>
        </div>

        {/* Step 4: Business Email */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
            4. Business Mailboxes
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setEmailBoxes(Math.max(1, emailBoxes - 1))}
              style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
            >
              -
            </button>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', minWidth: '40px', textAlign: 'center' }}>
              {emailBoxes}
            </span>
            <button
              type="button"
              onClick={() => setEmailBoxes(emailBoxes + 1)}
              style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
            >
              +
            </button>
          </div>
          <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748B', marginTop: '8px' }}>
            {emailBoxes} mailboxes ({formatPrice(emailBoxes * 0.99)}/mo)
          </span>
        </div>
      </div>

      {/* Summary Footer */}
      <div style={{ background: 'var(--slate-900)', borderRadius: '16px', padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            Estimated Package Total
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#9BCB44' }}>
              {formatPrice(effectiveMonthly)}
            </span>
            <span style={{ color: '#E2E8F0', fontSize: '0.95rem' }}>
              /month {billingCycle === 'annual' ? `(${formatPrice(annualTotal)} billed for 1st year)` : ''}
            </span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="btn btn-primary"
          style={{ padding: '14px 28px', fontSize: '1.05rem' }}
        >
          {loading ? 'Provisioning Custom Stack...' : 'Deploy Complete Stack →'}
        </button>
      </div>
    </div>
  );
}
