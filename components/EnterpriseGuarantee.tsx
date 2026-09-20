import React from 'react';

export default function EnterpriseGuarantee() {
  return (
    <section className="section section-dark">
      <div className="container">
        <div className="section-header">
          <span className="section-tag tag-cyan">Enterprise Reliability</span>
          <h2>Backed by Global Cloud Infrastructure</h2>
          <p className="lead">
            Every Hostmattic service is deployed on high-availability enterprise hardware engineered for lightning-fast speed, robust security, and 99.9% uptime SLA.
          </p>
        </div>

        <div className="grid-4" style={{ marginTop: '40px' }}>
          <div className="feature-card dark-feature-card" style={{ background: 'var(--slate-850)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>⚡</div>
            <h4 style={{ color: '#FFF', marginBottom: '8px' }}>Instant Activation</h4>
            <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Automated provisioning pipeline delivers your active credentials in under 60 seconds.
            </p>
          </div>
          <div className="feature-card dark-feature-card" style={{ background: 'var(--slate-850)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>🛡️</div>
            <h4 style={{ color: '#FFF', marginBottom: '8px' }}>DDoS Shield &amp; SSL</h4>
            <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Multi-layered scrubbing centers filter volumetric attacks before they ever reach your website.
            </p>
          </div>
          <div className="feature-card dark-feature-card" style={{ background: 'var(--slate-850)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>🌐</div>
            <h4 style={{ color: '#FFF', marginBottom: '8px' }}>Global Datacenters</h4>
            <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Deploy in premier Tier-4 facilities across the US, India, UK, and Hong Kong.
            </p>
          </div>
          <div className="feature-card dark-feature-card" style={{ background: 'var(--slate-850)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>💬</div>
            <h4 style={{ color: '#FFF', marginBottom: '8px' }}>24/7/365 SysAdmin Support</h4>
            <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Round-the-clock hosting experts ready to assist with migrations, DNS, and server tuning.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
