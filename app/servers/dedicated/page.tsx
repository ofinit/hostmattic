'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function DedicatedServerPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'Xeon E-2276G',
      desc: 'High-clock frequency dedicated server for demanding business workloads.',
      usdMonthly: 119.00,
      usdAnnualMonthly: 89.00,
      productType: 'DEDICATED',
      features: [
        '<strong>6 Cores / 12 Threads</strong> @ 3.8 GHz',
        '<strong>32 GB DDR4 ECC RAM</strong>',
        '<strong>2x 480 GB NVMe SSD</strong> (Hardware RAID-1)',
        '1 Gbps Unmetered Port',
        '5 Dedicated Usable IPv4 Addresses',
        'IPMI 2.0 Out-of-Band Remote Access',
      ],
    },
    {
      name: 'Dual Xeon Silver',
      desc: 'Dual-socket compute powerhouse for virtualization and large databases.',
      usdMonthly: 199.00,
      usdAnnualMonthly: 159.00,
      popular: true,
      productType: 'DEDICATED',
      features: [
        '<strong>16 Cores / 32 Threads</strong> (2x Xeon Silver)',
        '<strong>64 GB DDR4 ECC Registered RAM</strong>',
        '<strong>2x 960 GB Enterprise NVMe</strong>',
        'Hardware MegaRAID Controller with BBU',
        '1 Gbps Dedicated Port',
        'Full KVM / IPMI Remote Reboot',
      ],
    },
    {
      name: 'AMD EPYC 7543',
      desc: 'Extreme enterprise density for heavy SaaS clusters & private cloud.',
      usdMonthly: 349.00,
      usdAnnualMonthly: 289.00,
      productType: 'DEDICATED',
      features: [
        '<strong>32 Cores / 64 Threads</strong> AMD EPYC',
        '<strong>128 GB DDR4 ECC RAM</strong>',
        '<strong>2x 1.92 TB NVMe U.2 Enterprise SSD</strong>',
        '10 Gbps Redundant Network Uplink',
        'Hardware DDoS Scrubbing up to 1 Tbps',
        '100% Dedicated Unshared Hardware',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-gold">Enterprise Bare Metal</span>
          <h1>Dedicated Bare Metal Servers</h1>
          <p className="lead">
            Raw single-tenant hardware power. Zero virtualization overhead. Intel Xeon and AMD EPYC enterprise processors with hardware RAID-10, IPMI out-of-band management, and unmetered 1 Gbps uplinks.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Bare Metal Configurations</span>
            <h2>Choose Your Dedicated Machine</h2>
            <p className="lead">Deployed in ISO 27001 certified Tier-IV facilities with 99.99% hardware SLA.</p>
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
