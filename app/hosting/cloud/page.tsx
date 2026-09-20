'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function CloudHostingPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'Cloud 2 Core',
      desc: 'Dedicated cloud resources on redundant Ceph storage with auto-failover.',
      usdMonthly: 9.99,
      usdAnnualMonthly: 6.99,
      productType: 'CLOUD',
      features: [
        '<strong>2 Dedicated vCPU</strong> Cores',
        '<strong>2 GB Dedicated RAM</strong>',
        '<strong>40 GB NVMe Storage</strong>',
        'Unmetered Bandwidth',
        'Instant 4x Burst Compute',
        'Official cPanel Interface',
      ],
    },
    {
      name: 'Cloud 4 Core',
      desc: 'Our most popular cloud instance for high-concurrency apps & stores.',
      usdMonthly: 15.99,
      usdAnnualMonthly: 10.99,
      popular: true,
      productType: 'CLOUD',
      features: [
        '<strong>4 Dedicated vCPU</strong> Cores',
        '<strong>4 GB Dedicated RAM</strong>',
        '<strong>100 GB NVMe Storage</strong>',
        'Instant 4x Burst Scalability',
        'cPanel + Softaculous Suite',
        'Automated Snapshot Backups',
      ],
    },
    {
      name: 'Cloud 8 Core',
      desc: 'Maximum compute and memory allocations for heavy traffic portals.',
      usdMonthly: 28.99,
      usdAnnualMonthly: 19.99,
      productType: 'CLOUD',
      features: [
        '<strong>8 Dedicated vCPU</strong> Cores',
        '<strong>8 GB Dedicated RAM</strong>',
        '<strong>250 GB NVMe Storage</strong>',
        'Dedicated IP Address Included',
        'Priority Cloud Cluster Placement',
        '24/7 Dedicated Cloud SysAdmin',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-cyan">Cloud Infrastructure</span>
          <h1>High-Availability Cloud Web Hosting</h1>
          <p className="lead">
            Dedicated vCPU and RAM backed by fault-tolerant Ceph storage clusters with instant 4x burst scalability and seamless cPanel management.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Cloud Tiers</span>
            <h2>Select Your Dedicated Cloud Configuration</h2>
            <p className="lead">Zero resource contention. Your allocated CPU and RAM are 100% dedicated to you.</p>
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
