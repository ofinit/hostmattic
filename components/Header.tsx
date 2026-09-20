'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrency } from './CurrencyContext';
import { useCart } from './CartContext';

export default function Header() {
  const pathname = usePathname();
  const { currency, setCurrency, isLocked, lockedCurrency } = useCurrency();
  const { openCart, cartCount } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [navClosed, setNavClosed] = useState(false);

  const closeMenu = () => {
    setActiveMenu(null);
    setNavClosed(true);
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur();
    }
  };

  const handleNavMouseEnter = (menuName: string) => {
    setNavClosed(false);
    setActiveMenu(menuName);
  };

  const handleNavMouseLeave = () => {
    setActiveMenu(null);
    setNavClosed(false);
  };

  // Close any open mega-menus or mobile drawer when route changes
  useEffect(() => {
    closeMenu();
    setDrawerOpen(false);
    const t = setTimeout(() => setNavClosed(false), 200);
    return () => clearTimeout(t);
  }, [pathname]);

  // Close mega-menu if clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.desktop-nav')) {
        closeMenu();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Top Utility Bar */}
      <aside className="topbar">
        <div className="container">
          <div className="topbar-left">
            <span className="topbar-badge">
              <span className="pulse-dot"></span> 99.99% Network Uptime
            </span>
            <span className="topbar-text" style={{ color: '#CBD5E1' }}>
              Tier-IV Global Datacenters (US, India, UK, Hong Kong)
            </span>
          </div>
          <div className="topbar-right">
            <div
              className="currency-selector"
              title={
                isLocked
                  ? `Account currency is locked to ${lockedCurrency} for statutory tax and billing compliance`
                  : 'Switch Pricing Currency'
              }
            >
              <button
                className={`curr-btn ${currency === 'USD' ? 'active' : ''}`}
                onClick={() => setCurrency('USD')}
                disabled={isLocked && lockedCurrency !== 'USD'}
                style={isLocked && lockedCurrency !== 'USD' ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                title={isLocked && lockedCurrency === 'USD' ? '🔒 Locked Account Currency' : undefined}
              >
                {isLocked && lockedCurrency === 'USD' && <span style={{ marginRight: 3, fontSize: '0.85em' }}>🔒</span>}
                USD ($)
              </button>
              <button
                className={`curr-btn ${currency === 'INR' ? 'active' : ''}`}
                onClick={() => setCurrency('INR')}
                disabled={isLocked && lockedCurrency !== 'INR'}
                style={isLocked && lockedCurrency !== 'INR' ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                title={isLocked && lockedCurrency === 'INR' ? '🔒 Locked Account Currency' : undefined}
              >
                {isLocked && lockedCurrency === 'INR' && <span style={{ marginRight: 3, fontSize: '0.85em' }}>🔒</span>}
                INR (₹)
              </button>
            </div>
            <Link href="/login" className="topbar-link">
              Client Login
            </Link>
            <span style={{ color: '#64748B', margin: '0 6px', fontSize: '0.8rem' }}>•</span>
            <Link href="/register" className="topbar-link" style={{ color: 'var(--brand-lime)', fontWeight: 600 }}>
              Sign Up
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Sticky Header */}
      <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="container">
          <div className="nav-wrap">
            <Link href="/" className="site-logo" aria-label="Hostmattic Home">
              <picture>
                <source srcSet="/assets/img/hostmattic-logo.webp" type="image/webp" />
                <img
                  src="/assets/img/hostmattic-logo.png"
                  alt="Hostmattic Logo"
                  width="220"
                  height="42"
                  fetchPriority="high"
                  decoding="sync"
                  style={{ height: '42px', width: 'auto' }}
                />
              </picture>
            </Link>

            {/* Desktop Navigation Mega Menus */}
            <nav className="desktop-nav" aria-label="Primary Navigation" onMouseLeave={() => setActiveMenu(null)}>
              {/* 1. Domains Dropdown */}
              <div
                className={`nav-item ${activeMenu === 'domains' ? 'open' : ''} ${navClosed ? 'closed' : ''}`}
                onMouseEnter={() => handleNavMouseEnter('domains')}
                onMouseLeave={handleNavMouseLeave}
              >
                <Link href="/domains" className="nav-link" onClick={closeMenu}>
                  Domains
                  <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </Link>
                <div className="mega-menu">
                  <Link href="/domains" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-lime">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>Register a Domain</h4>
                      <p>Search &amp; register names across 800+ extensions with free DNS.</p>
                    </div>
                  </Link>
                  <Link href="/domains/transfer" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-cyan">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>Transfer Domain</h4>
                      <p>Move your existing domains to Hostmattic with zero downtime.</p>
                    </div>
                  </Link>
                  <Link href="/domains/new-gtlds" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-gold">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>New Domain Extensions</h4>
                      <p>Stand out with .tech, .store, .online, .app, .io and hundreds more.</p>
                    </div>
                  </Link>
                  <Link href="/domains#bulk" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-lime">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>Bulk Registration</h4>
                      <p>Check and register up to 50 domains in one seamless order.</p>
                    </div>
                  </Link>
                </div>
              </div>

              {/* 2. Hosting Dropdown */}
              <div
                className={`nav-item ${activeMenu === 'hosting' ? 'open' : ''} ${navClosed ? 'closed' : ''}`}
                onMouseEnter={() => handleNavMouseEnter('hosting')}
                onMouseLeave={handleNavMouseLeave}
              >
                <Link href="/hosting/shared-linux" className="nav-link" onClick={closeMenu}>
                  Hosting
                  <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </Link>
                <div className="mega-menu mega-wide">
                  <Link href="/hosting/shared-linux" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-lime">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="2" width="20" height="8" rx="2" />
                        <rect x="2" y="14" width="20" height="8" rx="2" />
                        <line x1="6" y1="6" x2="6.01" y2="6" />
                        <line x1="6" y1="18" x2="6.01" y2="18" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>Linux Shared Hosting</h4>
                      <p>cPanel, NVMe SSD, Softaculous 1-click install &amp; free SSL.</p>
                    </div>
                  </Link>
                  <Link href="/hosting/shared-windows" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-cyan">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="8" height="8" />
                        <rect x="13" y="3" width="8" height="8" />
                        <rect x="13" y="13" width="8" height="8" />
                        <rect x="3" y="13" width="8" height="8" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>Windows Plesk Hosting</h4>
                      <p>ASP.NET, MSSQL 2019, PHP &amp; IIS on robust Windows server.</p>
                    </div>
                  </Link>
                  <Link href="/hosting/wordpress" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-gold">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17.93V15h-2v4.93a8 8 0 0 1-5.93-3.66l3.32-9.11h2.12l3.32 9.11A8 8 0 0 1 13 19.93z" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>WordPress Hosting</h4>
                      <p>Engineered for WordPress with WP-CLI &amp; auto-updates.</p>
                    </div>
                  </Link>
                  <Link href="/hosting/cloud" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-cyan">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>Cloud Hosting</h4>
                      <p>Dedicated CPU &amp; RAM with instant 4x burst scalability.</p>
                    </div>
                  </Link>
                  <Link href="/hosting/reseller" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-lime">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>Reseller Web Hosting</h4>
                      <p>Start your own web host with WHM/cPanel &amp; custom nameservers.</p>
                    </div>
                  </Link>
                  <Link href="/bundles/combo-plans" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-gold">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>Combo Value Packs</h4>
                      <p>Domain + Hosting + Email + SSL bundled at massive savings.</p>
                    </div>
                  </Link>
                </div>
              </div>

              {/* 3. Servers Dropdown */}
              <div
                className={`nav-item ${activeMenu === 'servers' ? 'open' : ''} ${navClosed ? 'closed' : ''}`}
                onMouseEnter={() => handleNavMouseEnter('servers')}
                onMouseLeave={handleNavMouseLeave}
              >
                <Link href="/servers/vps" className="nav-link" onClick={closeMenu}>
                  Servers
                  <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </Link>
                <div className="mega-menu">
                  <Link href="/servers/vps" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-cyan">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    <div className="mega-text">
                      <h4>Linux KVM VPS</h4>
                      <p>Dedicated SSD storage, root access &amp; choice of Linux OS.</p>
                    </div>
                  </Link>
                  <Link href="/servers/dedicated" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-lime">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="2" width="20" height="20" rx="2" />
                        <line x1="2" y1="9" x2="22" y2="9" />
                        <line x1="2" y1="15" x2="22" y2="15" />
                        <line x1="6" y1="5.5" x2="6.01" y2="5.5" />
                        <line x1="6" y1="12" x2="6.01" y2="12" />
                        <line x1="6" y1="18.5" x2="6.01" y2="18.5" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>Dedicated Bare Metal</h4>
                      <p>Intel Xeon &amp; AMD EPYC enterprise processors with RAID-1/10.</p>
                    </div>
                  </Link>
                </div>
              </div>

              {/* 4. Email Dropdown */}
              <div
                className={`nav-item ${activeMenu === 'email' ? 'open' : ''} ${navClosed ? 'closed' : ''}`}
                onMouseEnter={() => handleNavMouseEnter('email')}
                onMouseLeave={handleNavMouseLeave}
              >
                <Link href="/email/business" className="nav-link" onClick={closeMenu}>
                  Email
                  <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </Link>
                <div className="mega-menu">
                  <Link href="/email/business" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-lime">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>Business Email</h4>
                      <p>Custom domain email, webmail, calendar sync &amp; anti-virus.</p>
                    </div>
                  </Link>
                  <Link href="/email/google-workspace" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-gold">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>Google Workspace</h4>
                      <p>Official Gmail, Drive, Docs &amp; Meet with DNS auto-setup.</p>
                    </div>
                  </Link>
                </div>
              </div>

              {/* 5. Security Dropdown */}
              <div
                className={`nav-item ${activeMenu === 'security' ? 'open' : ''} ${navClosed ? 'closed' : ''}`}
                onMouseEnter={() => handleNavMouseEnter('security')}
                onMouseLeave={handleNavMouseLeave}
              >
                <Link href="/security/ssl" className="nav-link" onClick={closeMenu}>
                  Security
                  <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </Link>
                <div className="mega-menu">
                  <Link href="/security/ssl" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-gold">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>SSL Certificates</h4>
                      <p>Sectigo &amp; Thawte DV, Wildcard &amp; EV SSL certificates.</p>
                    </div>
                  </Link>
                  <Link href="/security/sitelock" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-lime">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>SiteLock Protection</h4>
                      <p>Malware scanning, automatic cleaning &amp; Web Application Firewall.</p>
                    </div>
                  </Link>
                  <Link href="/security/codeguard" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-cyan">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>CodeGuard Backup</h4>
                      <p>Automated daily cloud backups with 1-click restore.</p>
                    </div>
                  </Link>
                  <Link href="/security/acronis" className="mega-item" onClick={closeMenu}>
                    <div className="mega-icon icon-gold">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 4.81 17 6 19 6a1 1 0 0 1 1 1z" />
                      </svg>
                    </div>
                    <div className="mega-text">
                      <h4>Acronis Cyber Backup</h4>
                      <p>Military-grade data protection against ransomware &amp; disaster.</p>
                    </div>
                  </Link>
                </div>
              </div>

              {/* All Products Directory Link */}
              <div className="nav-item">
                <Link href="/products" className="nav-link" onClick={closeMenu} style={{ color: 'var(--brand-action-cyan)', fontWeight: 700 }}>
                  All Products
                </Link>
              </div>
            </nav>

            {/* Actions */}
            <div className="nav-actions">
              <button
                type="button"
                onClick={openCart}
                className="cart-trigger-btn"
                aria-label={`Shopping Cart (${cartCount} items)`}
                title="View Cart & Checkout"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                {cartCount > 0 && <span className="cart-badge-pill">{cartCount}</span>}
              </button>

              <Link href="/products" className="btn btn-sm btn-primary header-explore-btn">
                Explore Products
              </Link>
              <button
                className="hamburger-btn"
                aria-label="Open Mobile Menu"
                onClick={() => setDrawerOpen(true)}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="mobile-drawer open" role="dialog" aria-modal="true">
          <div className="drawer-content">
            <div className="drawer-header">
              <picture>
                <source srcSet="/assets/img/hostmattic-logo.webp" type="image/webp" />
                <img
                  src="/assets/img/hostmattic-logo.png"
                  alt="Hostmattic"
                  width="160"
                  height="32"
                  loading="lazy"
                  decoding="async"
                  style={{ height: '32px', width: 'auto' }}
                />
              </picture>
              <button className="drawer-close" aria-label="Close Menu" onClick={() => setDrawerOpen(false)}>
                &times;
              </button>
            </div>
            <div className="drawer-group-title">Domains &amp; Web</div>
            <ul className="drawer-menu">
              <li><Link href="/domains" onClick={() => setDrawerOpen(false)}>Register a Domain</Link></li>
              <li><Link href="/domains/transfer" onClick={() => setDrawerOpen(false)}>Transfer Domain</Link></li>
              <li><Link href="/domains/new-gtlds" onClick={() => setDrawerOpen(false)}>New Domain Extensions</Link></li>
              <li><Link href="/tools/website-builder" onClick={() => setDrawerOpen(false)}>Website Builder</Link></li>
            </ul>
            <div className="drawer-group-title">Hosting &amp; Servers</div>
            <ul className="drawer-menu">
              <li><Link href="/hosting/shared-linux" onClick={() => setDrawerOpen(false)}>Linux Shared (cPanel)</Link></li>
              <li><Link href="/hosting/shared-windows" onClick={() => setDrawerOpen(false)}>Windows Shared (Plesk)</Link></li>
              <li><Link href="/hosting/wordpress" onClick={() => setDrawerOpen(false)}>WordPress Hosting</Link></li>
              <li><Link href="/hosting/cloud" onClick={() => setDrawerOpen(false)}>Cloud Hosting</Link></li>
              <li><Link href="/hosting/reseller" onClick={() => setDrawerOpen(false)}>Reseller Hosting</Link></li>
              <li><Link href="/servers/vps" onClick={() => setDrawerOpen(false)}>Linux KVM VPS</Link></li>
              <li><Link href="/servers/dedicated" onClick={() => setDrawerOpen(false)}>Dedicated Servers</Link></li>
            </ul>
            <div className="drawer-group-title">Email &amp; Security</div>
            <ul className="drawer-menu">
              <li><Link href="/email/business" onClick={() => setDrawerOpen(false)}>Business Email</Link></li>
              <li><Link href="/email/google-workspace" onClick={() => setDrawerOpen(false)}>Google Workspace</Link></li>
              <li><Link href="/security/ssl" onClick={() => setDrawerOpen(false)}>SSL Certificates</Link></li>
              <li><Link href="/security/sitelock" onClick={() => setDrawerOpen(false)}>SiteLock Malware Guard</Link></li>
              <li><Link href="/security/codeguard" onClick={() => setDrawerOpen(false)}>CodeGuard Backups</Link></li>
              <li><Link href="/security/acronis" onClick={() => setDrawerOpen(false)}>Acronis Cyber Backup</Link></li>
              <li><Link href="/bundles/combo-plans" onClick={() => setDrawerOpen(false)}>Combo Offers</Link></li>
              <li><Link href="/products" onClick={() => setDrawerOpen(false)}>All Products &amp; Solutions Directory</Link></li>
            </ul>
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link
                href="/login"
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setDrawerOpen(false)}
              >
                Client Portal Login
              </Link>
              <Link
                href="/register"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setDrawerOpen(false)}
              >
                Create Account →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
