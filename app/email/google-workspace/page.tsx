'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function GoogleWorkspacePage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'Business Starter',
      desc: 'Official Google collaboration suite for growing modern businesses.',
      usdMonthly: 7.20,
      usdAnnualMonthly: 6.00,
      productType: 'EMAIL_GOOGLE',
      features: [
        'Custom Business Email (Gmail)',
        '<strong>30 GB Cloud Storage</strong> per user (Drive)',
        '100 Participant Video Meetings (Meet)',
        'Google Docs, Sheets, Slides, Forms',
        'Automated Hostmattic DNS Auto-Setup',
      ],
    },
    {
      name: 'Business Standard',
      desc: 'Enhanced storage and video meeting recording for collaborative teams.',
      usdMonthly: 14.40,
      usdAnnualMonthly: 12.00,
      popular: true,
      productType: 'EMAIL_GOOGLE',
      features: [
        'Custom Business Email (Gmail)',
        '<strong>2 TB Cloud Storage</strong> per user',
        '150 Participant Video Meetings + Recording',
        'Shared Team Drives &amp; Advanced Controls',
        'Standard Google Workspace Support',
      ],
    },
    {
      name: 'Business Plus',
      desc: 'Advanced security, vault e-discovery, and expanded cloud storage.',
      usdMonthly: 21.60,
      usdAnnualMonthly: 18.00,
      productType: 'EMAIL_GOOGLE',
      features: [
        'Custom Business Email + eDiscovery (Vault)',
        '<strong>5 TB Cloud Storage</strong> per user',
        '500 Participant Meetings + Attendance Tracking',
        'Advanced Security &amp; Management Controls',
        'Google Vault for Data Retention',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-gold">Official Google Workspace</span>
          <h1>Google Workspace for Business</h1>
          <p className="lead">
            Supercharge your team with the tools they already love. Official Gmail, Drive, Docs, Sheets, and Meet integrated with automated DNS configuration.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Workspace Plans</span>
            <h2>Select Your Google Workspace Edition</h2>
            <p className="lead">Instant provisioning. We automate MX, SPF, DKIM, and DMARC verification.</p>
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
