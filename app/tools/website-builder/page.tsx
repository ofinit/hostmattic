'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function WebsiteBuilderPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'Builder Personal',
      desc: 'Create beautiful personal portfolios, event pages, and resumes.',
      usdMonthly: 4.49,
      usdAnnualMonthly: 2.99,
      productType: 'TOOLS_BUILDER',
      features: [
        'Publish <strong>1 Website</strong> (Up to 10 Pages)',
        '50+ Mobile-Responsive Designer Templates',
        'Drag-and-Drop Visual Editor',
        'Free Hosting &amp; SSL Certificate Included',
        'Basic Contact Forms &amp; Social Links',
      ],
    },
    {
      name: 'Builder Business',
      desc: 'Our premier builder package with unlimited pages and lead tools.',
      usdMonthly: 7.99,
      usdAnnualMonthly: 4.99,
      popular: true,
      productType: 'TOOLS_BUILDER',
      features: [
        'Publish <strong>Unlimited Pages</strong>',
        '200+ Premium Industry Templates',
        'Built-in SEO Meta &amp; Analytics Tools',
        'Custom Domain Connection with Free SSL',
        'Interactive Galleries, Sliders &amp; Videos',
        'Automated Mobile Preview &amp; Editing',
      ],
    },
    {
      name: 'Builder E-Commerce',
      desc: 'Complete online storefront builder with shopping cart & payment gateways.',
      usdMonthly: 15.99,
      usdAnnualMonthly: 10.99,
      productType: 'TOOLS_BUILDER',
      features: [
        'Sell up to <strong>500 Products</strong> Online',
        'Zero Transaction Fees from Hostmattic',
        'Integrated Credit Card &amp; PayPal Gateways',
        'Inventory Tracking &amp; Automated Order Emails',
        'Discount Coupons &amp; Promotion Engine',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-cyan">Drag-and-Drop Visual Editor</span>
          <h1>DIY Website Builder — No Coding Required</h1>
          <p className="lead">
            Build a stunning, mobile-responsive website in minutes with our drag-and-drop website builder. Choose from 200+ industry templates, customize with ease, and launch today.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Builder Tiers</span>
            <h2>Select Your Website Builder Package</h2>
            <p className="lead">Hosting, cloud storage, and SSL certificates are 100% included in all tiers.</p>
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
