'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function WordPressPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'WP Starter',
      desc: 'Built specifically for high-speed WordPress blogs and landing pages.',
      usdMonthly: 5.99,
      usdAnnualMonthly: 3.99,
      productType: 'WORDPRESS',
      features: [
        '<strong>1 WordPress Site</strong> pre-installed',
        '<strong>20 GB NVMe SSD</strong> Storage',
        'Auto Core &amp; Plugin Updates',
        'Varnish Caching Accelerator',
        'Free Let&apos;s Encrypt SSL Certificate',
        'WP-CLI &amp; SFTP Direct Access',
      ],
    },
    {
      name: 'WP Business',
      desc: 'Our premier WordPress tier for WooCommerce and multi-site networks.',
      usdMonthly: 9.99,
      usdAnnualMonthly: 6.99,
      popular: true,
      productType: 'WORDPRESS',
      features: [
        '<strong>Up to 5 WordPress Sites</strong>',
        '<strong>60 GB NVMe SSD</strong> Storage',
        'Automated Staging Environment',
        'WooCommerce Speed Optimization',
        'Daily Cloud Snapshots &amp; 1-Click Restore',
        'Global CDN &amp; Asset Minification',
      ],
    },
    {
      name: 'WP Scale',
      desc: 'High-concurrency cluster for media agencies and viral online stores.',
      usdMonthly: 19.99,
      usdAnnualMonthly: 14.99,
      productType: 'WORDPRESS',
      features: [
        '<strong>Unlimited WordPress Sites</strong>',
        '<strong>Unlimited NVMe SSD</strong> Storage',
        'Dedicated PHP-FPM Worker Threads',
        'Free Premium Wildcard SSL',
        'Dedicated IP Address Included',
        '24/7 Dedicated WordPress SysAdmin',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-gold">Managed WordPress</span>
          <h1>Engineered for Blazing Fast WordPress</h1>
          <p className="lead">
            Lightning performance powered by NVMe arrays, Varnish edge caching, automated core updates, and 1-click staging environments.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Optimized Tiers</span>
            <h2>Choose Your WordPress Plan</h2>
            <p className="lead">Experience up to 300% faster page loading times out-of-the-box.</p>
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
