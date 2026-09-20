'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function SiteLockPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'SiteLock Find',
      desc: 'Daily automated scanning for malware, blacklists, and security holes.',
      usdMonthly: 3.49,
      usdAnnualMonthly: 2.49,
      productType: 'SECURITY_SITELOCK',
      features: [
        'Daily Malware Scan (Up to 500 pages)',
        'Google Blacklist Monitoring',
        'Spam &amp; Phishing Check',
        'SiteLock Trust Seal for your website',
      ],
    },
    {
      name: 'SiteLock Fix',
      desc: 'Automatic detection AND instant removal of malicious injected scripts.',
      usdMonthly: 7.99,
      usdAnnualMonthly: 5.99,
      popular: true,
      productType: 'SECURITY_SITELOCK',
      features: [
        'Automated Malware Removal (SMART)',
        'Continuous Vulnerability Scanning',
        'Database &amp; File Integrity Checks',
        'Trust Seal with live verification',
      ],
    },
    {
      name: 'SiteLock Defend',
      desc: 'Enterprise Web Application Firewall (WAF) to block bad bots & DDoS.',
      usdMonthly: 19.99,
      usdAnnualMonthly: 14.99,
      productType: 'SECURITY_SITELOCK',
      features: [
        'TrueShield Web Application Firewall',
        'Layer 7 DDoS Protection Shield',
        'Global CDN Edge Speed Booster',
        'Automated Malware Removal &amp; Repair',
        'Dedicated Security Specialist Support',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-lime">Automated Web Defense</span>
          <h1>SiteLock Website Malware Protection</h1>
          <p className="lead">
            Detect, prevent, and automatically remove website malware before search engines blacklist your brand. Includes Web Application Firewall and CDN acceleration.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">SiteLock Plans</span>
            <h2>Select Your SiteLock Defense Tier</h2>
            <p className="lead">Keep your website clean, fast, and secure 24/7/365.</p>
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
