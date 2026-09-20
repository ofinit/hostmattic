'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function ComboPlansPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'Startup Combo',
      desc: 'Everything you need to launch a professional online presence in minutes.',
      usdMonthly: 6.99,
      usdAnnualMonthly: 4.49,
      productType: 'COMBO_PLANS',
      features: [
        '<strong>1 Free Domain Name</strong> (.com or .in)',
        '<strong>10 GB NVMe Shared Hosting</strong>',
        'Official <strong>cPanel Control Panel</strong>',
        'Free Let&apos;s Encrypt SSL Certificate',
        '2 Business Email Mailboxes',
        'Softaculous 1-Click WordPress Installer',
      ],
    },
    {
      name: 'Business Growth Pack',
      desc: 'Our bestselling bundle. Enhanced compute, unlimited websites & security.',
      usdMonthly: 12.99,
      usdAnnualMonthly: 7.99,
      popular: true,
      productType: 'COMBO_PLANS',
      features: [
        '<strong>1 Free Domain Name</strong> (.com / .in / .tech)',
        '<strong>Unlimited NVMe Web Hosting</strong>',
        'Official <strong>cPanel Control Panel</strong>',
        'Free Lifetime Wildcard SSL Certificate',
        'Unlimited Custom Business Email Accounts',
        'Automated Daily Cloud Backups',
      ],
    },
    {
      name: 'Executive Agency Suite',
      desc: 'Ultimate package with Cloud NVMe compute, security, and priority VIP support.',
      usdMonthly: 24.99,
      usdAnnualMonthly: 16.99,
      productType: 'COMBO_PLANS',
      features: [
        '<strong>1 Free Premium Domain Registration</strong>',
        '<strong>Cloud NVMe Dedicated Compute</strong> (2 vCPU)',
        'Free PositiveSSL Certificate Included',
        'SiteLock Web Application Firewall',
        'CodeGuard Daily Cloud Backups',
        '24/7 Dedicated SysAdmin Support',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-lime">All-in-One Savings</span>
          <h1>Combo Value Packs — Up to 60% Savings</h1>
          <p className="lead">
            Everything your business needs in one streamlined package. Bundled domain name, high-speed NVMe hosting, business email, and SSL certificate at huge savings.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Combo Bundles</span>
            <h2>Choose Your Value Pack</h2>
            <p className="lead">One invoice, one renewal date, zero hassle.</p>
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
