'use client';

import React, { useState } from 'react';
import BillingToggle from '@/components/BillingToggle';
import PricingCard, { PlanData } from '@/components/PricingCard';
import EnterpriseGuarantee from '@/components/EnterpriseGuarantee';

export default function SharedWindowsPage() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

  const plans: PlanData[] = [
    {
      name: 'Standard .NET',
      desc: 'Engineered for ASP.NET applications, MSSQL 2019, and Windows workloads.',
      usdMonthly: 4.99,
      usdAnnualMonthly: 3.49,
      productType: 'SHARED_WINDOWS',
      features: [
        '<strong>1 Website</strong> on Windows Server 2022',
        '<strong>15 GB NVMe SSD</strong> Storage',
        'Official <strong>Plesk Obsidian Panel</strong>',
        'ASP.NET Core &amp; .NET Framework 4.8',
        '1 MSSQL 2019 Database (1 GB)',
        'Unlimited MySQL MariaDB Databases',
        'Free Let&apos;s Encrypt SSL',
      ],
    },
    {
      name: 'Professional .NET',
      desc: 'Our flagship Windows hosting tier for enterprise .NET sites and web portals.',
      usdMonthly: 9.99,
      usdAnnualMonthly: 6.99,
      popular: true,
      productType: 'SHARED_WINDOWS',
      features: [
        '<strong>5 Websites</strong> on Windows 2022',
        '<strong>60 GB NVMe SSD</strong> Storage',
        'Official <strong>Plesk Obsidian Panel</strong>',
        'ASP.NET Core, MVC &amp; PHP 8.x',
        '5 MSSQL 2019 Databases (5 GB total)',
        'Unlimited MySQL Databases',
        'Free SSL &amp; Daily Cloud Backups',
      ],
    },
    {
      name: 'Enterprise Windows',
      desc: 'Maximum compute, storage, and database allocations for corporate apps.',
      usdMonthly: 16.99,
      usdAnnualMonthly: 11.99,
      productType: 'SHARED_WINDOWS',
      features: [
        '<strong>Unlimited Websites</strong>',
        '<strong>Unlimited NVMe SSD</strong> Storage',
        'Official <strong>Plesk Obsidian Panel</strong>',
        'Dedicated Application Pools',
        'Unlimited MSSQL 2019 &amp; MySQL DBs',
        'Dedicated IP Address Included',
        '24/7 VIP Windows SysAdmin Support',
      ],
    },
  ];

  return (
    <>
      <section className="hero-product">
        <div className="container">
          <span className="section-tag tag-cyan">Windows Plesk Hosting</span>
          <h1>ASP.NET &amp; Windows Server 2022 Web Hosting</h1>
          <p className="lead">
            Optimized Windows hosting powered by Plesk Obsidian, ASP.NET Core, MSSQL 2019, and high-performance IIS web servers.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag tag-cyan">Windows Tiers</span>
            <h2>Choose Your Windows Hosting Plan</h2>
            <p className="lead">All plans backed by 99.9% uptime SLA and instant activation.</p>
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
