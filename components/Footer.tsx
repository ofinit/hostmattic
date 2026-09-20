import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Col 1: Brand & Identity */}
          <div className="footer-brand-col">
            <Link href="/" className="footer-logo">
              <picture>
                <source srcSet="/assets/img/hostmattic-logo-white.webp" type="image/webp" />
                <img
                  src="/assets/img/hostmattic-logo-white.png"
                  alt="Hostmattic"
                  width="200"
                  height="38"
                  loading="lazy"
                  decoding="async"
                  style={{ height: '38px', width: 'auto' }}
                />
              </picture>
            </Link>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.6, margin: '16px 0 20px' }}>
              Hostmattic delivers high-performance enterprise cloud hosting, domain registrations across 800+ TLDs, NVMe VPS clusters, dedicated bare-metal servers, and business email suites.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span className="topbar-badge" style={{ background: 'rgba(155,203,68,0.15)', color: '#9BCB44' }}>
                <span className="pulse-dot"></span> Tier-IV Datacenters
              </span>
              <span className="topbar-badge" style={{ background: 'rgba(41,180,213,0.15)', color: '#29B4D5' }}>
                256-Bit SSL
              </span>
            </div>
          </div>

          {/* Col 2: Domains & DNS */}
          <div className="footer-col">
            <h4 className="footer-title">Domains</h4>
            <ul className="footer-links">
              <li><Link href="/domains">Register a Domain</Link></li>
              <li><Link href="/domains/transfer">Transfer Your Domain</Link></li>
              <li><Link href="/domains/new-gtlds">New Domain Extensions</Link></li>
              <li><Link href="/domains#bulk">Bulk Search &amp; Order</Link></li>
              <li><Link href="/domains">WHOIS Privacy Shield</Link></li>
              <li><Link href="/domains">Premium DNS Management</Link></li>
            </ul>
          </div>

          {/* Col 3: Web Hosting */}
          <div className="footer-col">
            <h4 className="footer-title">Web Hosting</h4>
            <ul className="footer-links">
              <li><Link href="/hosting/shared-linux">Linux Shared (cPanel)</Link></li>
              <li><Link href="/hosting/shared-windows">Windows Shared (Plesk)</Link></li>
              <li><Link href="/hosting/wordpress">Managed WordPress</Link></li>
              <li><Link href="/hosting/cloud">Cloud Web Hosting</Link></li>
              <li><Link href="/hosting/reseller">Reseller Web Hosting</Link></li>
              <li><Link href="/bundles/combo-plans">Combo Value Packs</Link></li>
            </ul>
          </div>

          {/* Col 4: Cloud & Bare Metal */}
          <div className="footer-col">
            <h4 className="footer-title">Servers &amp; Cloud</h4>
            <ul className="footer-links">
              <li><Link href="/servers/vps">Linux KVM VPS</Link></li>
              <li><Link href="/servers/dedicated">Dedicated Bare Metal</Link></li>
              <li><Link href="/hosting/cloud">Scalable Cloud Compute</Link></li>
              <li><Link href="/servers/vps#specs">Custom OS &amp; Storage</Link></li>
              <li><Link href="/servers/dedicated#network">1 Gbps Unmetered Port</Link></li>
              <li><Link href="/tools/website-builder">DIY Website Builder</Link></li>
            </ul>
          </div>

          {/* Col 5: Security & Email */}
          <div className="footer-col">
            <h4 className="footer-title">Email &amp; Security</h4>
            <ul className="footer-links">
              <li><Link href="/email/business">Business Custom Email</Link></li>
              <li><Link href="/email/google-workspace">Google Workspace</Link></li>
              <li><Link href="/security/ssl">SSL Certificates</Link></li>
              <li><Link href="/security/sitelock">SiteLock Malware Guard</Link></li>
              <li><Link href="/security/codeguard">CodeGuard Backups</Link></li>
              <li><Link href="/security/acronis">Acronis Cyber Backup</Link></li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <div>
            &copy; 2026 Hostmattic - Enterprise Cloud Hosting &amp; Infrastructure. A business unit of OfinIT Solutions Pvt. Ltd. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            <Link href="/products" style={{ color: '#94A3B8' }}>Products Directory</Link>
            <Link href="/#faq" style={{ color: '#94A3B8' }}>Knowledge Base</Link>
            <Link href="/login" style={{ color: '#94A3B8' }}>Customer Portal</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
