'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function CodeGuardPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'CodeGuard Starter',
      desc: 'Automated daily cloud backups for small websites and blogs.',
      usdMonthly: 2.99,
      usdAnnualMonthly: 1.99,
      productType: 'SECURITY_CODEGUARD',
      features: [
        '<strong>1 GB Backup Storage</strong>',
        'Daily Automatic Cloud Backups',
        'Website Files &amp; MySQL Database',
        '1-Click Automated Restore',
        'Automated Change Monitoring',
      ],
    },
    {
      name: 'CodeGuard Professional',
      desc: 'Our most popular backup plan for business websites and stores.',
      usdMonthly: 4.99,
      usdAnnualMonthly: 3.49,
      popular: true,
      productType: 'SECURITY_CODEGUARD',
      features: [
        '<strong>5 GB Backup Storage</strong>',
        'Unlimited Website &amp; DB Backups',
        'Daily Automatic Version Snapshots',
        'Zip Download of any historical point',
        'On-demand Backup Triggers',
      ],
    },
    {
      name: 'CodeGuard Enterprise',
      desc: 'Generous storage allocation for agencies and multi-site networks.',
      usdMonthly: 9.99,
      usdAnnualMonthly: 6.99,
      productType: 'SECURITY_CODEGUARD',
      features: [
        '<strong>25 GB Backup Storage</strong>',
        'Unlimited Websites &amp; MySQL DBs',
        'Continuous Realtime Monitoring',
        'Malware Detection in Backups',
        'Priority Backup Rollback Service',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-cyan">Automated Cloud Backups</span>
          <h1>CodeGuard Cloud Backup &amp; 1-Click Restore</h1>
          <p className="lead">
            Never worry about website crashes, accidental deletions, or corrupt updates again. CodeGuard backs up your website daily and lets you roll back with one click.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Backup Tiers</span>
            <h2>Select Your Backup Capacity</h2>
            <p className="lead">Automated set-it-and-forget-it protection.</p>
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
