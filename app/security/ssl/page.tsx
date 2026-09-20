'use client';

import React from 'react';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';
import { useCurrency } from '@/components/CurrencyContext';
import { useCart } from '@/components/CartContext';

export default function SslPage() {
  const { formatPrice } = useCurrency();
  const { addItem } = useCart();

  const certs = [
    {
      name: 'PositiveSSL (DV)',
      desc: 'Fast domain validation certificate for standard websites, blogs, and landing pages.',
      usdYear: 11.99,
      features: [
        'Domain Validation (Issued in 5 mins)',
        '256-Bit Industry Standard Encryption',
        '99.9% Browser &amp; Mobile Recognition',
        '$10,000 Relying Party Warranty',
        'Free TrustLogo Site Seal',
      ],
    },
    {
      name: 'PositiveSSL Wildcard',
      desc: 'Secure your main domain and unlimited subdomains (*.yourdomain.com) with 1 cert.',
      usdYear: 69.99,
      popular: true,
      features: [
        'Secures Unlimited Subdomains (*.domain.com)',
        'Domain Validation with fast issuance',
        '256-Bit Encryption / 2048-Bit Key',
        '$50,000 Relying Party Warranty',
        'Unlimited Server Licenses',
      ],
    },
    {
      name: 'Comodo EV SSL',
      desc: 'Extended validation with highest trust tier, business verification, and green bar signal.',
      usdYear: 149.00,
      features: [
        'Rigorous Business Entity Verification',
        'Maximum Consumer Trust &amp; Conversion',
        '256-Bit Encryption / 2048-Bit RSA',
        '$1,750,000 Enterprise Warranty',
        'Dynamic Corner of Trust Site Seal',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-gold">256-Bit SSL Security</span>
          <h1>Industry-Standard SSL Certificates</h1>
          <p className="lead">
            Protect sensitive customer data, encrypt checkout carts, and satisfy modern browser HTTPS requirements with trusted certificates from Sectigo and Comodo.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="grid-3">
            {certs.map((c) => (
              <div key={c.name} className={`pricing-card ${c.popular ? 'popular' : ''}`}>
                {c.popular && <span className="card-ribbon">Most Popular</span>}
                <div className="plan-header">
                  <h3 className="plan-name">{c.name}</h3>
                  <p className="plan-desc">{c.desc}</p>
                  <div className="plan-price-wrap">
                    <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0F172A' }}>
                      {formatPrice(c.usdYear)}
                    </span>
                    <span className="plan-period">/year</span>
                  </div>
                </div>

                <ul className="feature-list">
                  {c.features.map((f, i) => (
                    <li key={i} className="feature-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      <span dangerouslySetInnerHTML={{ __html: f }} />
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() =>
                    addItem({
                      type: 'SECURITY',
                      name: `${c.name} SSL Certificate`,
                      billingPeriod: 'annual',
                      priceMonthly: Number((c.usdYear / 12).toFixed(2)),
                      priceAnnual: c.usdYear,
                    }, true)
                  }
                  className={`btn ${c.popular ? 'btn-primary' : 'btn-outline'}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Order SSL Certificate →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <EnterpriseGuarantee />
    </>
  );
}
