'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCurrency } from '@/components/CurrencyContext';

interface ProductItem {
  id: string;
  category: 'domains' | 'hosting' | 'servers' | 'email' | 'security' | 'bundles';
  title: string;
  description: string;
  priceText: string;
  usdPrice: number;
  priceSuffix: string;
  pill: string;
  link: string;
  btnText: string;
}

export default function ProductsPage() {
  const { formatPrice } = useCurrency();
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');

  const products: ProductItem[] = [
    {
      id: 'domain-reg',
      category: 'domains',
      title: 'Domain Registration',
      description: 'Instant registration across 800+ gTLDs and ccTLDs (.com, .in, .net, .org, .io) with free DNS management and mail forwarding.',
      priceText: 'From $7.99/yr',
      usdPrice: 7.99,
      priceSuffix: '/yr',
      pill: 'Free DNS Management & Mail Forwarding',
      link: '/domains',
      btnText: 'View Domain Plans →',
    },
    {
      id: 'domain-transfer',
      category: 'domains',
      title: 'Domain Transfer',
      description: 'Consolidate your domains to Hostmattic with automated transfer authentication, zero downtime, and a free 1-year renewal extension.',
      priceText: 'Free 1-Yr Extension',
      usdPrice: 7.99,
      priceSuffix: '/transfer',
      pill: 'Zero Downtime Transfer & Free 1-Yr Extension',
      link: '/domains/transfer',
      btnText: 'Transfer Guide →',
    },
    {
      id: 'new-gtlds',
      category: 'domains',
      title: 'New Domain Extensions',
      description: 'Stand out in your industry with niche extensions like .tech, .online, .store, .agency, .app, and .dev with instant availability checks.',
      priceText: 'From $3.99/yr',
      usdPrice: 3.99,
      priceSuffix: '/yr',
      pill: '800+ Modern Niche Extensions Available',
      link: '/domains/new-gtlds',
      btnText: 'Explore Extensions →',
    },
    {
      id: 'shared-linux',
      category: 'hosting',
      title: 'Linux Shared (cPanel)',
      description: 'NVMe SSD arrays, official cPanel interface, Softaculous 1-click app installer, PHP 8.x, and free Let’s Encrypt SSL certificates.',
      priceText: 'From $2.49/mo',
      usdPrice: 2.49,
      priceSuffix: '/mo',
      pill: 'cPanel Included • Softaculous 1-Click Installs',
      link: '/hosting/shared-linux',
      btnText: 'View Linux Plans →',
    },
    {
      id: 'shared-windows',
      category: 'hosting',
      title: 'Windows Shared (Plesk)',
      description: 'Native Windows Server 2022 environment with Plesk Obsidian, ASP.NET Core, MSSQL 2019 databases, and PHP support.',
      priceText: 'From $3.49/mo',
      usdPrice: 3.49,
      priceSuffix: '/mo',
      pill: 'Plesk Panel • ASP.NET & MSSQL Support',
      link: '/hosting/shared-windows',
      btnText: 'View Windows Plans →',
    },
    {
      id: 'wordpress',
      category: 'hosting',
      title: 'Managed WordPress Hosting',
      description: 'Dedicated WordPress infrastructure with pre-installed WP, automated core/plugin updates, WP-CLI tools, and Varnish caching.',
      priceText: 'From $3.99/mo',
      usdPrice: 3.99,
      priceSuffix: '/mo',
      pill: 'Optimized WP-CLI • Automated Core Updates',
      link: '/hosting/wordpress',
      btnText: 'View WP Plans →',
    },
    {
      id: 'cloud',
      category: 'hosting',
      title: 'Cloud Web Hosting',
      description: 'Dedicated vCPU & RAM on fault-tolerant Ceph storage with cPanel, automatic hardware failover, and instantaneous 4x burst compute.',
      priceText: 'From $6.99/mo',
      usdPrice: 6.99,
      priceSuffix: '/mo',
      pill: 'Dedicated RAM/CPU • Instant 4x Scalability',
      link: '/hosting/cloud',
      btnText: 'View Cloud Plans →',
    },
    {
      id: 'reseller',
      category: 'hosting',
      title: 'Reseller Web Hosting',
      description: 'White-label Linux cPanel/WHM and Windows Plesk reseller packages with automated license generation and private nameservers.',
      priceText: 'From $16.99/mo',
      usdPrice: 16.99,
      priceSuffix: '/mo',
      pill: 'WHM & cPanel Access • 100% White-Label',
      link: '/hosting/reseller',
      btnText: 'View Reseller Plans →',
    },
    {
      id: 'vps',
      category: 'servers',
      title: 'Linux KVM VPS',
      description: 'Kernel-based Virtual Machine with guaranteed vCPU, dedicated RAM, NVMe storage, root access, and choice of Ubuntu, AlmaLinux, or Debian.',
      priceText: 'From $8.99/mo',
      usdPrice: 8.99,
      priceSuffix: '/mo',
      pill: 'Full Root Access • Dedicated KVM Virtualization',
      link: '/servers/vps',
      btnText: 'View VPS Specs →',
    },
    {
      id: 'dedicated',
      category: 'servers',
      title: 'Dedicated Bare Metal Servers',
      description: 'Raw single-tenant hardware powered by Intel Xeon & AMD EPYC with RAID-1/10 storage, IPMI remote access, and unmetered bandwidth.',
      priceText: 'From $89.00/mo',
      usdPrice: 89.00,
      priceSuffix: '/mo',
      pill: 'Enterprise Bare Metal • Hardware RAID Storage',
      link: '/servers/dedicated',
      btnText: 'View Bare Metal →',
    },
    {
      id: 'business-email',
      category: 'email',
      title: 'Business Email',
      description: 'Professional custom domain email (you@yourcompany.com) with 5 GB storage, intuitive webmail, calendar sync, and anti-virus filtering.',
      priceText: 'From $0.99/mo',
      usdPrice: 0.99,
      priceSuffix: '/mo/box',
      pill: 'Custom Domain Email • Anti-Spam & Webmail',
      link: '/email/business',
      btnText: 'View Email Plans →',
    },
    {
      id: 'google-workspace',
      category: 'email',
      title: 'Google Workspace',
      description: 'Official enterprise Google Workspace suite including Gmail, Google Drive cloud storage, Docs, Sheets, and Google Meet with automated DNS setup.',
      priceText: 'From $6.00/mo',
      usdPrice: 6.00,
      priceSuffix: '/mo/user',
      pill: 'Official Gmail, Drive, Docs & Meet Suite',
      link: '/email/google-workspace',
      btnText: 'Google Workspace Plans →',
    },
    {
      id: 'ssl',
      category: 'security',
      title: 'SSL Certificates',
      description: 'Industry-standard 256-bit encryption from Sectigo and Thawte. Available in Domain Validation (DV), Wildcard (*.domain.com), and Extended Validation (EV).',
      priceText: 'From $11.99/yr',
      usdPrice: 11.99,
      priceSuffix: '/yr',
      pill: '256-Bit Encryption • Sectigo & Thawte Verified',
      link: '/security/ssl',
      btnText: 'View SSL Options →',
    },
    {
      id: 'sitelock',
      category: 'security',
      title: 'SiteLock Web Security',
      description: 'Comprehensive website protection with daily vulnerability scanning, automated malware cleanup, and Web Application Firewall (WAF).',
      priceText: 'From $2.49/mo',
      usdPrice: 2.49,
      priceSuffix: '/mo',
      pill: 'Daily Malware Scanning • Web Application Firewall',
      link: '/security/sitelock',
      btnText: 'View SiteLock Tiers →',
    },
    {
      id: 'codeguard',
      category: 'security',
      title: 'CodeGuard Cloud Backup',
      description: 'Automated daily cloud backups for your website files and MySQL databases with version tracking, change alerts, and 1-click restore.',
      priceText: 'From $1.99/mo',
      usdPrice: 1.99,
      priceSuffix: '/mo',
      pill: 'Automatic Cloud Backups • 1-Click File Restore',
      link: '/security/codeguard',
      btnText: 'View Backup Plans →',
    },
    {
      id: 'acronis',
      category: 'security',
      title: 'Acronis Cyber Backup',
      description: 'Enterprise disaster recovery and cloud backup powered by Acronis Cyber Cloud with military-grade AES-256 encryption and anti-ransomware protection.',
      priceText: 'From $4.99/mo',
      usdPrice: 4.99,
      priceSuffix: '/mo',
      pill: 'Military-Grade Ransomware Defense & Full Backup',
      link: '/security/acronis',
      btnText: 'View Acronis Storage →',
    },
    {
      id: 'combo-plans',
      category: 'bundles',
      title: 'Combo Value Packs',
      description: 'All-in-one business bundles combining high-speed cloud hosting, a free domain name, custom email accounts, and a free SSL certificate at up to 60% off.',
      priceText: 'From $4.49/mo',
      usdPrice: 4.49,
      priceSuffix: '/mo',
      pill: 'All-in-One: Domain + Hosting + Email + SSL',
      link: '/bundles/combo-plans',
      btnText: 'Explore Combo Packs →',
    },
    {
      id: 'website-builder',
      category: 'bundles',
      title: 'DIY Website Builder',
      description: 'Intuitive drag-and-drop website builder with 200+ responsive designer templates, built-in e-commerce cart, SEO tools, and free hosting.',
      priceText: 'From $2.99/mo',
      usdPrice: 2.99,
      priceSuffix: '/mo',
      pill: 'Drag-and-Drop Builder • Responsive Mobile Themes',
      link: '/tools/website-builder',
      btnText: 'Start Building →',
    },
  ];

  const filtered = products.filter((p) => {
    const matchesCat = activeCat === 'all' || p.category === activeCat;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.pill.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-cyan">Full Product Suite</span>
          <h1>Hostmattic Product &amp; Service Catalog</h1>
          <p className="lead">
            Explore Hostmattic&apos;s complete ecosystem of high-performance web hosting, domain registration, dedicated servers, enterprise email, and cybersecurity solutions designed for businesses of all sizes.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {/* Filter Bar */}
          <div className="catalog-filter-bar">
            {/* Search Input Row */}
            <div className="catalog-search-row">
              <div className="catalog-search-wrap">
                <span className="catalog-search-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="catalog-search-input"
                  placeholder="Search products, hosting plans, servers, domains, or security tools..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="catalog-search-clear"
                    onClick={() => setSearch('')}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="catalog-result-count">
                Showing <strong>{filtered.length}</strong> of {products.length}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="filter-tabs">
              <button
                className={`filter-tab ${activeCat === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCat('all')}
              >
                All Products <span className="filter-count-badge">{products.length}</span>
              </button>
              <button
                className={`filter-tab ${activeCat === 'domains' ? 'active' : ''}`}
                onClick={() => setActiveCat('domains')}
              >
                🌐 Domains <span className="filter-count-badge">{products.filter((p) => p.category === 'domains').length}</span>
              </button>
              <button
                className={`filter-tab ${activeCat === 'hosting' ? 'active' : ''}`}
                onClick={() => setActiveCat('hosting')}
              >
                ⚡ Web Hosting <span className="filter-count-badge">{products.filter((p) => p.category === 'hosting').length}</span>
              </button>
              <button
                className={`filter-tab ${activeCat === 'servers' ? 'active' : ''}`}
                onClick={() => setActiveCat('servers')}
              >
                🖥️ Servers <span className="filter-count-badge">{products.filter((p) => p.category === 'servers').length}</span>
              </button>
              <button
                className={`filter-tab ${activeCat === 'email' ? 'active' : ''}`}
                onClick={() => setActiveCat('email')}
              >
                ✉️ Email <span className="filter-count-badge">{products.filter((p) => p.category === 'email').length}</span>
              </button>
              <button
                className={`filter-tab ${activeCat === 'security' ? 'active' : ''}`}
                onClick={() => setActiveCat('security')}
              >
                🛡️ Security <span className="filter-count-badge">{products.filter((p) => p.category === 'security').length}</span>
              </button>
              <button
                className={`filter-tab ${activeCat === 'bundles' ? 'active' : ''}`}
                onClick={() => setActiveCat('bundles')}
              >
                📦 Bundles &amp; Tools <span className="filter-count-badge">{products.filter((p) => p.category === 'bundles').length}</span>
              </button>
            </div>
          </div>

          {/* Catalog Grid */}
          <div className="grid-3">
            {filtered.length === 0 ? (
              <div className="catalog-empty-state">
                <div className="catalog-empty-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-main)' }}>
                  No products match &ldquo;{search}&rdquo;
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                  Try refining your search terms or view our full ecosystem of cloud services.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setActiveCat('all');
                  }}
                  className="btn btn-sm btn-primary"
                >
                  Reset Filters &amp; View All (18)
                </button>
              </div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="catalog-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span className="section-tag tag-cyan" style={{ margin: 0, textTransform: 'capitalize' }}>
                        {item.category}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--brand-action-green)' }}>
                        From {formatPrice(item.usdPrice)}{item.priceSuffix}
                      </span>
                    </div>
                    <h3 style={{ marginBottom: '6px' }}>
                      <Link href={item.link}>{item.title}</Link>
                    </h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{item.description}</p>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'var(--brand-action-cyan)',
                        background: 'var(--brand-cyan-light)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        marginTop: '12px',
                      }}
                    >
                      {item.pill}
                    </div>
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    <Link href={item.link} className="btn btn-sm btn-outline" style={{ width: '100%' }}>
                      {item.btnText}
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}
