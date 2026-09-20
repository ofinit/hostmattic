'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function VpsPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'Standard VPS',
      desc: 'Entry-level dedicated virtual server with full root access.',
      usdMonthly: 11.99,
      usdAnnualMonthly: 8.99,
      productType: 'VPS',
      features: [
        '<strong>1 vCPU Core</strong> (Intel Xeon)',
        '<strong>2 GB DDR4 RAM</strong>',
        '<strong>30 GB NVMe Storage</strong>',
        '1 TB Monthly Bandwidth',
        '1 Dedicated IPv4 Address',
        'Choice of Ubuntu, AlmaLinux, Debian',
        'Full Root SSH Access',
      ],
    },
    {
      name: 'Business VPS',
      desc: 'For production web servers, Docker containers, and microservices.',
      usdMonthly: 21.99,
      usdAnnualMonthly: 16.99,
      popular: true,
      productType: 'VPS',
      features: [
        '<strong>2 vCPU Cores</strong> (Intel Xeon)',
        '<strong>4 GB DDR4 RAM</strong>',
        '<strong>60 GB NVMe Storage</strong>',
        '2 TB Monthly Bandwidth',
        '1 Dedicated IPv4 Address',
        'Automated Weekly Snapshot Backups',
        'Optional cPanel / Plesk License',
      ],
    },
    {
      name: 'Pro VPS',
      desc: 'High-RAM and CPU configuration for busy databases and APIs.',
      usdMonthly: 39.99,
      usdAnnualMonthly: 29.99,
      productType: 'VPS',
      features: [
        '<strong>4 vCPU Cores</strong> (Intel Xeon)',
        '<strong>8 GB DDR4 RAM</strong>',
        '<strong>120 GB NVMe Storage</strong>',
        '3 TB Monthly Bandwidth',
        '2 Dedicated IPv4 Addresses',
        'Hardware DDoS Mitigation Included',
        '24/7 Dedicated Server Support',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-cyan">Linux KVM Virtualization</span>
          <h1>High-Performance Linux KVM VPS</h1>
          <p className="lead">
            Dedicated NVMe storage, dedicated RAM, and full root access. Powered by enterprise KVM hypervisors with guaranteed compute allocations and instant OS provisioning.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">VPS Tiers</span>
            <h2>Select Your Virtual Server Specification</h2>
            <p className="lead">Scalable on-demand. Upgrade CPU, RAM, and NVMe disks with zero downtime.</p>
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
