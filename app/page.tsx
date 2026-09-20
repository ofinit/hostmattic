'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DomainSearchBox from '@/components/DomainSearchBox';
import StackBuilder from '@/components/StackBuilder';
import { useCurrency } from '@/components/CurrencyContext';

export default function HomePage() {
  const { formatPrice } = useCurrency();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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

  const trendingTlds = [
    { ext: '.com', defaultUsd: 13.16, href: '/domains' },
    { ext: '.in', defaultUsd: 9.33, href: '/domains' },
    { ext: '.net', defaultUsd: 15.07, href: '/domains' },
    { ext: '.org', defaultUsd: 13.29, href: '/domains' },
    { ext: '.tech', defaultUsd: 12.24, href: '/domains/new-gtlds' },
    { ext: '.online', defaultUsd: 8.81, href: '/domains/new-gtlds' },
    { ext: '.io', defaultUsd: 49.99, href: '/domains/new-gtlds' },
  ];

  const faqs = [
    {
      q: 'How fast will my web hosting or domain order be activated?',
      a: 'Every order placed through Hostmattic is fully automated through our enterprise provisioning engine. Domains, email accounts, and web hosting environments are typically active and ready within 30 to 60 seconds after order confirmation.',
    },
    {
      q: 'Can I transfer my existing website from another hosting provider?',
      a: 'Yes! Our certified migration team will transfer your cPanel accounts, WordPress sites, databases, and emails to Hostmattic with zero downtime at no additional charge.',
    },
    {
      q: 'Do you offer multiple global datacenter locations?',
      a: 'Yes. During checkout you can select from premier Tier-IV datacenter clusters located in the United States, India, the United Kingdom, and Hong Kong for ultra-low latency.',
    },
    {
      q: 'Are automated backups included with your hosting plans?',
      a: 'All plans include automated daily snapshot backups. You can also deploy CodeGuard or Acronis Cyber Backup for 1-click file and database rollback at any time.',
    },
    {
      q: 'What level of technical support do you provide?',
      a: 'We provide 24/7/365 dedicated technical support staffed by certified Linux and Windows sysadmins via live chat, ticketing, and phone assistance.',
    },
  ];

  return (
    <>
      {/* HERO SECTION */}
      <section className="hero-home">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Automated Cloud Provisioning in 30 Seconds
            </div>
            <h1 className="hero-title">
              Everything Your Digital Business Needs, <em>In One Account.</em>
            </h1>
            <p className="hero-lead">
              High-speed NVMe cloud hosting, domain registrations across 800+ extensions, business email, and enterprise security designed for businesses, developers, and digital agencies.
            </p>

            {/* Interactive Domain Search */}
            <DomainSearchBox />

            {/* TLD Price Quick Pills */}
            <div className="tld-pill-strip" style={{ marginTop: '24px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, alignSelf: 'center', marginRight: '4px' }}>
                Trending extensions:
              </span>
              {trendingTlds.map((item) => {
                const live = pricingData[item.ext];
                const priceUsd = live?.retailUsd || item.defaultUsd;
                const isPromo = Boolean(live?.isPromo);

                return (
                  <Link key={item.ext} href={item.href} className="tld-pill">
                    <strong>{item.ext}</strong> {formatPrice(priceUsd)}/yr
                    {isPromo && live?.badge && (
                      <span
                        style={{
                          marginLeft: '5px',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          background: '#FFEDD5',
                          color: '#C2410C',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {live.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CORE 6 SERVICE CATEGORIES */}
      <section className="section section-subtle">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-gold">Complete Product Ecosystem</span>
            <h2>Explore All 18 Cloud &amp; Hosting Solutions</h2>
            <p className="lead">
              Every service is powered by enterprise-grade cloud automation, high-performance NVMe storage, and instant order provisioning.
            </p>
          </div>

          <div className="grid-3">
            {/* 1. Domains Suite */}
            <div className="feature-card">
              <div className="feature-icon-box icon-lime">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h3>Domain Names &amp; TLDs</h3>
              <p>Registration, transfers, bulk availability checks, premium domains, whois privacy, and DNSSEC across 800+ TLD extensions.</p>
              <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link href="/domains" className="btn btn-sm btn-outline">Domain Suite →</Link>
                <Link href="/domains/transfer" className="btn btn-sm btn-outline">Transfer →</Link>
              </div>
            </div>

            {/* 2. Web Hosting */}
            <div className="feature-card">
              <div className="feature-icon-box icon-cyan">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="8" rx="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
              </div>
              <h3>Web Hosting &amp; CMS</h3>
              <p>Linux cPanel, Windows Plesk, managed WordPress with automated updates, and cloud hosting with instant 4x burst scalability.</p>
              <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link href="/hosting/shared-linux" className="btn btn-sm btn-outline">Linux cPanel →</Link>
                <Link href="/hosting/wordpress" className="btn btn-sm btn-outline">WordPress →</Link>
              </div>
            </div>

            {/* 3. Servers & Infrastructure */}
            <div className="feature-card">
              <div className="feature-icon-box icon-gold">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <rect x="9" y="9" width="6" height="6" />
                  <line x1="9" y1="1" x2="9" y2="4" />
                  <line x1="15" y1="1" x2="15" y2="4" />
                  <line x1="9" y1="20" x2="9" y2="23" />
                  <line x1="15" y1="20" x2="15" y2="23" />
                  <line x1="20" y1="9" x2="23" y2="9" />
                  <line x1="20" y1="14" x2="23" y2="14" />
                  <line x1="1" y1="9" x2="4" y2="9" />
                  <line x1="1" y1="14" x2="4" y2="14" />
                </svg>
              </div>
              <h3>Virtual &amp; Dedicated Servers</h3>
              <p>KVM Linux VPS with full root access, dedicated bare-metal Intel Xeon/AMD EPYC servers with RAID-10 storage and 1 Gbps unmetered uplinks.</p>
              <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link href="/servers/vps" className="btn btn-sm btn-outline">KVM VPS →</Link>
                <Link href="/servers/dedicated" className="btn btn-sm btn-outline">Bare Metal →</Link>
              </div>
            </div>

            {/* 4. Reseller Hosting */}
            <div className="feature-card">
              <div className="feature-icon-box icon-lime">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3>Reseller Web Hosting</h3>
              <p>Launch your own web hosting agency with Linux WHM/cPanel or Windows Plesk. Automated client account creation and private branded nameservers.</p>
              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <Link href="/hosting/reseller" className="btn btn-sm btn-outline">Explore Reseller Plans →</Link>
              </div>
            </div>

            {/* 5. Business Email Suites */}
            <div className="feature-card">
              <div className="feature-icon-box icon-cyan">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h3>Email &amp; Productivity</h3>
              <p>Professional branded email (you@yourdomain.com), calendar sync, webmail, and full official Google Workspace integration with automated DNS records.</p>
              <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link href="/email/business" className="btn btn-sm btn-outline">Business Email →</Link>
                <Link href="/email/google-workspace" className="btn btn-sm btn-outline">Google Suite →</Link>
              </div>
            </div>

            {/* 6. Cybersecurity & Continuity */}
            <div className="feature-card">
              <div className="feature-icon-box icon-gold">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3>Security &amp; Cloud Backup</h3>
              <p>Sectigo SSL certificates, SiteLock automated malware removal, CodeGuard daily website rollback backups, and Acronis cyber disaster protection.</p>
              <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link href="/security/ssl" className="btn btn-sm btn-outline">SSL Certs →</Link>
                <Link href="/security/codeguard" className="btn btn-sm btn-outline">Backups →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE STACK BUILDER */}
      <section className="section">
        <div className="container">
          <StackBuilder />
        </div>
      </section>

      {/* ENTERPRISE ARCHITECTURE & PERFORMANCE */}
      <section className="section section-dark">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Enterprise Architecture</span>
            <h2>Engineered for Extreme Speed &amp; 99.9% Uptime</h2>
            <p className="lead">
              Built on enterprise-grade hardware with redundant power feeds, carrier-neutral network backbones, and intelligent multi-region failover.
            </p>
          </div>

          <div className="grid-4" style={{ marginTop: '40px' }}>
            <div className="feature-card dark-feature-card" style={{ background: 'var(--slate-850)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>⚡</div>
              <h4 style={{ color: '#FFF', marginBottom: '8px' }}>Pure NVMe Storage</h4>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: 1.5 }}>
                Enterprise NVMe arrays delivering up to 10x faster I/O throughput than conventional SSDs.
              </p>
            </div>
            <div className="feature-card dark-feature-card" style={{ background: 'var(--slate-850)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>🛡️</div>
              <h4 style={{ color: '#FFF', marginBottom: '8px' }}>Zero-Downtime Migration</h4>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: 1.5 }}>
                Our specialized migration team transfers your websites, databases, and emails with zero interruption.
              </p>
            </div>
            <div className="feature-card dark-feature-card" style={{ background: 'var(--slate-850)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>🌐</div>
              <h4 style={{ color: '#FFF', marginBottom: '8px' }}>Anycast DNS Network</h4>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: 1.5 }}>
                Global DNS nodes respond from the nearest geographic pop for ultra-low latency query resolution.
              </p>
            </div>
            <div className="feature-card dark-feature-card" style={{ background: 'var(--slate-850)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>💬</div>
              <h4 style={{ color: '#FFF', marginBottom: '8px' }}>24/7/365 Expert Support</h4>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: 1.5 }}>
                Certified Linux and Windows sysadmins available via live chat and ticket support anytime.
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '36px' }}>
            <Link href="/products" className="btn btn-primary">
              Browse All Products &amp; Solutions →
            </Link>
          </div>
        </div>
      </section>

      {/* FREQUENTLY ASKED QUESTIONS */}
      <section className="section" id="faq">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-lime">Got Questions?</span>
            <h2>Frequently Asked Questions</h2>
            <p className="lead">Everything you need to know about our web hosting, domain provisioning, and customer support.</p>
          </div>

          <div style={{ maxWidth: '820px', margin: '0 auto' }}>
            {faqs.map((f, i) => (
              <div
                key={i}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%',
                    padding: '18px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#0F172A',
                  }}
                >
                  <span>{f.q}</span>
                  <span style={{ fontSize: '1.3rem', color: 'var(--brand-action-cyan)' }}>
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 24px 20px', color: '#475569', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
