'use client';

import React, { useState, useEffect } from 'react';
import DomainSearchBox from '@/components/DomainSearchBox';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';
import { useCurrency } from '@/components/CurrencyContext';

export default function DomainsPage() {
  const { formatPrice } = useCurrency();
  const [pricingData, setPricingData] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch('/api/domains/pricing')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.pricing) {
          setPricingData(d.pricing);
        }
      })
      .catch(() => {});
  }, []);

  const tldConfigs = [
    { ext: '.com', defaultUsd: 13.16, defaultBadge: 'Most Popular', desc: 'The undisputed global standard for businesses & brands.' },
    { ext: '.in', defaultUsd: 9.33, defaultBadge: 'Best in India', desc: 'Ideal for companies targeting the vibrant Indian market.' },
    { ext: '.net', defaultUsd: 15.07, defaultBadge: 'Tech Classic', desc: 'Trusted by tech leaders and network infrastructures.' },
    { ext: '.org', defaultUsd: 13.29, defaultBadge: 'Special Offer', desc: 'The proven choice for communities, NGOs, and open projects.' },
    { ext: '.tech', defaultUsd: 12.24, defaultBadge: '73% OFF', desc: 'Built for developers, engineering teams, and startups.' },
    { ext: '.online', defaultUsd: 8.81, defaultBadge: '75% OFF', desc: 'Versatile, modern extension for any online presence.' },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-lime">Global Domain Registrar</span>
          <h1>Find &amp; Secure Your Domain Name</h1>
          <p className="lead">
            Search over 800+ top-level extensions with instant live registration. Every domain includes free DNS management, mail forwarding, and theft-protection locking.
          </p>

          <div style={{ marginTop: '36px' }}>
            <DomainSearchBox />
          </div>
        </div>
      </section>

      {/* Featured TLDs */}
      <section className="section section-subtle">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Popular Extensions</span>
            <h2>Top Domain Names at Wholesale Rates</h2>
            <p className="lead">All registrations include free DNS Zone editing, privacy protection, and automated renewal safeguards.</p>
          </div>

          <div className="grid-3">
            {tldConfigs.map((t) => {
              const live = pricingData[t.ext];
              const priceUsd = live?.retailUsd || t.defaultUsd;
              const badge = live?.badge || t.defaultBadge;
              const isPromo = Boolean(live?.isPromo);

              return (
                <div key={t.ext} className="pricing-card" style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '1.8rem', color: '#0F172A', margin: 0 }}>{t.ext}</h3>
                    <span
                      style={{
                        background: isPromo
                          ? 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)'
                          : 'rgba(255, 205, 0, 0.15)',
                        color: isPromo ? '#E11D48' : '#A2700C',
                        border: isPromo ? '1px solid #FECDD3' : '1px solid rgba(255, 205, 0, 0.35)',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: isPromo ? '0 1px 3px rgba(225, 29, 72, 0.08)' : 'none',
                      }}
                    >
                      {isPromo ? `🔥 ${badge}` : badge}
                    </span>
                  </div>
                  <p style={{ color: '#64748B', fontSize: '0.88rem', minHeight: '44px' }}>{t.desc}</p>
                  <div style={{ margin: '16px 0', fontSize: '1.8rem', fontWeight: 800, color: 'var(--brand-action-green)' }}>
                    {formatPrice(priceUsd)}
                    <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 500 }}>/year</span>
                    {isPromo && live?.promoEndsAt && (
                      <div style={{ fontSize: '0.74rem', color: '#E11D48', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>⏳</span>
                        <span>Promo ends: {new Date(live.promoEndsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                  <ul className="feature-list" style={{ marginBottom: '20px' }}>
                    <li className="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> Free Anycast DNS Management</li>
                    <li className="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> 2 Free Mail Forwarders</li>
                    <li className="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> Domain Theft Lock Protection</li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      const inp = document.querySelector('.domain-input') as HTMLInputElement;
                      if (inp) {
                        inp.focus();
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                        nativeInputValueSetter?.call(inp, 'mybrand' + t.ext);
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                      }
                    }}
                    className="btn btn-sm btn-outline"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Register {t.ext} →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <EnterpriseGuarantee />
    </>
  );
}
