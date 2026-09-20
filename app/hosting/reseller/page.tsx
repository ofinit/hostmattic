'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function ResellerHostingPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'Reseller Essential',
      desc: 'Launch your web hosting brand with WHM and isolated cPanel accounts.',
      usdMonthly: 24.99,
      usdAnnualMonthly: 16.99,
      productType: 'RESELLER',
      features: [
        '<strong>40 GB NVMe Storage</strong>',
        '<strong>800 GB Monthly Bandwidth</strong>',
        'Create up to <strong>25 cPanel Accounts</strong>',
        'Full WHM WebHost Manager Access',
        '100% White-Label Private Nameservers',
        'Free Automated SSL for all clients',
      ],
    },
    {
      name: 'Reseller Advanced',
      desc: 'Our most popular reseller tier for active agencies and web studios.',
      usdMonthly: 38.99,
      usdAnnualMonthly: 26.99,
      popular: true,
      productType: 'RESELLER',
      features: [
        '<strong>100 GB NVMe Storage</strong>',
        '<strong>2,000 GB Bandwidth</strong>',
        'Create up to <strong>75 cPanel Accounts</strong>',
        'Full WHM Root-Level Controls',
        'Custom Nameservers &amp; Brand Styling',
        'Automated Softaculous Apps for clients',
        'Free Dedicated IP Address Included',
      ],
    },
    {
      name: 'Reseller Master',
      desc: 'High-capacity environment for established hosting resellers and IT shops.',
      usdMonthly: 59.99,
      usdAnnualMonthly: 42.99,
      productType: 'RESELLER',
      features: [
        '<strong>250 GB NVMe Storage</strong>',
        '<strong>4,000 GB Bandwidth</strong>',
        '<strong>Unlimited cPanel Accounts</strong>',
        'Full WHM WebHost Manager',
        'Free Dedicated IP Address',
        'Priority Reseller Queue &amp; VIP Support',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-lime">White-Label Reseller</span>
          <h1>Start Your Own Web Hosting Company</h1>
          <p className="lead">
            Turnkey Linux cPanel/WHM reseller hosting. Host unlimited clients under your own brand with custom nameservers, isolated resource quotas, and automated client activation.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Reseller Tiers</span>
            <h2>Select Your Reseller Package</h2>
            <p className="lead">You set the prices, bill your clients, and keep 100% of the profits.</p>
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
