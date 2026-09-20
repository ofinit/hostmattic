'use client';

import React from 'react';
import DomainSearchBox from '@/components/DomainSearchBox';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';
import { useCurrency } from '@/components/CurrencyContext';

export default function NewGtldsPage() {
  const { formatPrice } = useCurrency();
  const [pricingData, setPricingData] = React.useState<Record<string, any>>({});

  React.useEffect(() => {
    fetch('/api/domains/pricing')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.pricing) {
          setPricingData(d.pricing);
        }
      })
      .catch(() => {});
  }, []);

  const categories = [
    { cat: 'Tech & Startups', tlds: ['.tech', '.dev', '.app', '.io', '.ai', '.cloud'] },
    { cat: 'Commerce & Retail', tlds: ['.store', '.shop', '.online', '.site', '.vip'] },
    { cat: 'Creative & Media', tlds: ['.live', '.xyz', '.club', '.website', '.pro', '.top'] },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-gold">800+ Modern Extensions</span>
          <h1>New &amp; Niche Domain Extensions</h1>
          <p className="lead">
            Stand out in your industry with targeted extensions that tell the world exactly who you are.
          </p>

          <div style={{ marginTop: '36px' }}>
            <DomainSearchBox />
          </div>
        </div>
      </section>

      <section className="section section-subtle">
        <div className="container">
          <div className="grid-3">
            {categories.map((c) => (
              <div key={c.cat} className="pricing-card" style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: '1.3rem', color: '#0F172A', marginBottom: '16px' }}>{c.cat}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {c.tlds.map((t) => {
                    const live = pricingData[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          const inp = document.querySelector('.domain-input') as HTMLInputElement;
                          if (inp) {
                            inp.focus();
                            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                            nativeInputValueSetter?.call(inp, 'mybrand' + t);
                            inp.dispatchEvent(new Event('input', { bubbles: true }));
                          }
                        }}
                        style={{
                          background: live?.isPromo ? '#FEF2F2' : '#FFFFFF',
                          border: live?.isPromo ? '1px solid #FCA5A5' : '1px solid #CBD5E1',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontWeight: 700,
                          color: live?.isPromo ? '#B91C1C' : 'var(--brand-action-cyan)',
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--brand-action-green)';
                          e.currentTarget.style.color = 'var(--brand-action-green)';
                          e.currentTarget.style.background = 'var(--brand-lime-light)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = live?.isPromo ? '#FCA5A5' : '#CBD5E1';
                          e.currentTarget.style.color = live?.isPromo ? '#B91C1C' : 'var(--brand-action-cyan)';
                          e.currentTarget.style.background = live?.isPromo ? '#FEF2F2' : '#FFFFFF';
                        }}
                        title={live?.isPromo && live?.promoEndsAt ? `Special Registry Promo: ${live.badge} — Valid till ${new Date(live.promoEndsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}` : `Register ${t}`}
                      >
                        <span>{t}</span>
                        {live?.retailUsd && (
                          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                            {formatPrice(live.retailUsd)}
                          </span>
                        )}
                        {live?.isPromo && live?.badge && (
                          <span
                            style={{
                              background: 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)',
                              border: '1px solid #FECDD3',
                              color: '#E11D48',
                              fontSize: '0.65rem',
                              padding: '2px 7px',
                              borderRadius: '999px',
                              fontWeight: 800,
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 2px rgba(225, 29, 72, 0.08)',
                            }}
                          >
                            🔥 {live.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <EnterpriseGuarantee />
    </>
  );
}
