'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function AcronisPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'Acronis 50 GB',
      desc: 'Military-grade cyber protection for core databases and virtual servers.',
      usdMonthly: 6.99,
      usdAnnualMonthly: 4.99,
      productType: 'SECURITY_ACRONIS',
      features: [
        '<strong>50 GB Encrypted Cloud Storage</strong>',
        'AI-Powered Active Ransomware Shield',
        'Full System Image &amp; Granular Recovery',
        'AES-256 Bit In-Flight &amp; At-Rest Encryption',
        'Bare-Metal Server Restore',
      ],
    },
    {
      name: 'Acronis 250 GB',
      desc: 'Our premier cyber protection tier for high-volume corporate infrastructures.',
      usdMonthly: 19.99,
      usdAnnualMonthly: 14.99,
      popular: true,
      productType: 'SECURITY_ACRONIS',
      features: [
        '<strong>250 GB Encrypted Cloud Storage</strong>',
        'Full Disks, Partitions &amp; Files Protection',
        'Zero-Trust Threat Telemetry',
        'Multi-Cloud &amp; Hybrid Storage Replicas',
        'Automated Disaster Recovery Testing',
      ],
    },
    {
      name: 'Acronis 1 TB',
      desc: 'Massive enterprise vault for mission-critical multi-server clusters.',
      usdMonthly: 59.99,
      usdAnnualMonthly: 44.99,
      productType: 'SECURITY_ACRONIS',
      features: [
        '<strong>1,000 GB (1 TB) Cloud Vault</strong>',
        'Unlimited Workstations &amp; Server Instances',
        'Real-time Anti-Malware &amp; Anti-Virus Defenses',
        'Instant Cloud Failover RTO under 15 mins',
        'Dedicated Acronis SysAdmin Assistance',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-gold">Military-Grade Cyber Backup</span>
          <h1>Acronis Cyber Disaster Recovery</h1>
          <p className="lead">
            The world’s leading all-in-one cyber protection solution. Combines full-image cloud backup with AI-based defense against zero-day ransomware and data corruption.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Acronis Storage Tiers</span>
            <h2>Select Your Cloud Vault Capacity</h2>
            <p className="lead">Scale storage dynamically with no disruption to active servers.</p>
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
