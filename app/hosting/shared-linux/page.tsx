'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function SharedLinuxPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'Starter',
      desc: 'Ideal for single websites, personal blogs, and emerging projects.',
      usdMonthly: 3.99,
      usdAnnualMonthly: 2.49,
      productType: 'SHARED_LINUX',
      features: [
        '<strong>1 Website</strong> hosted',
        '<strong>10 GB NVMe SSD</strong> Storage',
        'Unmetered Bandwidth',
        'Official <strong>cPanel Control Panel</strong>',
        'Free Let&apos;s Encrypt SSL Certificate',
        'Softaculous 1-Click App Installer',
        '5 Custom Business Email Accounts',
      ],
    },
    {
      name: 'Performance',
      desc: 'Our most popular tier for fast-growing businesses & e-commerce.',
      usdMonthly: 7.99,
      usdAnnualMonthly: 4.99,
      popular: true,
      productType: 'SHARED_LINUX',
      features: [
        '<strong>Unlimited Websites</strong>',
        '<strong>50 GB NVMe SSD</strong> Storage',
        'Unmetered Bandwidth',
        'Official <strong>cPanel Control Panel</strong>',
        'Free Lifetime SSL Certificates',
        'Softaculous 400+ 1-Click Apps',
        'Unlimited Business Email Accounts',
        'Free Automated Daily Backups',
      ],
    },
    {
      name: 'Business Pro',
      desc: 'High-resource environment for agencies and high-traffic portals.',
      usdMonthly: 12.99,
      usdAnnualMonthly: 8.49,
      productType: 'SHARED_LINUX',
      features: [
        '<strong>Unlimited Websites</strong>',
        '<strong>Unlimited NVMe SSD</strong> Storage',
        'Unmetered Bandwidth &amp; 2x CPU',
        'Official <strong>cPanel Control Panel</strong>',
        'Free Premium Wildcard SSL',
        'LiteSpeed + LSCache Turbo Boost',
        'Free Dedicated IP Address',
        'Priority 24/7 VIP SysAdmin Support',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-lime">Linux cPanel Hosting</span>
          <h1>High-Speed NVMe Shared Web Hosting</h1>
          <p className="lead">
            Deploy your websites on lightning-fast enterprise Linux clusters with cPanel, PHP 8.2+, MariaDB, automated Let’s Encrypt SSL, and Softaculous 1-click app installs.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Flexible Tiers</span>
            <h2>Choose Your Shared Hosting Plan</h2>
            <p className="lead">All plans backed by 99.9% uptime SLA and 30-day money-back guarantee.</p>
          </div>

          <BillingToggle cycle={cycle} onChange={setCycle} />

          <div className="grid-3">
            {plans.map((p) => (
              <PricingCard key={p.name} plan={p} billingCycle={cycle} />
            ))}
          </div>
        </div>
      </section>

      <EnterpriseGuarantee />
    </>
  );
}
