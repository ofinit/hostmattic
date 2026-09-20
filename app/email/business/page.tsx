'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function BusinessEmailPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'Business Mail Starter',
      desc: 'Professional custom domain email for solopreneurs & small teams.',
      usdMonthly: 1.49,
      usdAnnualMonthly: 0.99,
      productType: 'EMAIL_BUSINESS',
      features: [
        '<strong>5 GB Storage</strong> per mailbox',
        'Custom domain address (you@yourdomain.com)',
        'Modern Webmail Interface + Calendar',
        'IMAP / POP3 / SMTP Support',
        'Built-in Anti-Spam &amp; Anti-Virus Filter',
      ],
    },
    {
      name: 'Business Mail Pro',
      desc: 'Expanded mailbox quota with advanced collaborative productivity tools.',
      usdMonthly: 2.99,
      usdAnnualMonthly: 1.99,
      popular: true,
      productType: 'EMAIL_BUSINESS',
      features: [
        '<strong>25 GB Storage</strong> per mailbox',
        'Team Calendar &amp; Contacts Sync',
        'Shared Tasks &amp; Document Notes',
        'Outlook, Apple Mail &amp; Mobile App Sync',
        'Automated Out-of-Office Responders',
        'Advanced TLS Email Encryption',
      ],
    },
    {
      name: 'Enterprise Exchange',
      desc: 'High-volume corporate email hosting with archiving and e-discovery.',
      usdMonthly: 5.99,
      usdAnnualMonthly: 4.49,
      productType: 'EMAIL_BUSINESS',
      features: [
        '<strong>50 GB Storage</strong> per mailbox',
        'Enterprise Compliance &amp; Archiving',
        'ActiveSync for iOS &amp; Android',
        'Unlimited Email Aliases',
        'Priority 24/7 Mail Routing SLA',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-lime">Professional Email</span>
          <h1>Custom Domain Business Email</h1>
          <p className="lead">
            Build instant trust with your clients. Professional email matching your domain (you@yourbrand.com) with intuitive webmail, calendar sync, anti-spam filters, and reliable delivery.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Email Plans</span>
            <h2>Choose Your Email Mailbox Tier</h2>
            <p className="lead">Add as many mailboxes as your company grows.</p>
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
