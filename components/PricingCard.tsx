'use client';

import React from 'react';
import { useCurrency } from './CurrencyContext';
import { useCart } from './CartContext';

export interface PlanData {
  name: string;
  desc: string;
  usdMonthly: number;
  usdAnnualMonthly: number; // e.g. $2.49/mo when billed annually
  popular?: boolean;
  features: string[];
  productType: string;
  /**
   * The plan's name in the upstream catalogue, where it differs from the name
   * we sell it under. Live pricing is matched on this; without it a plan keeps
   * its published price, because matching tiers by position would put the top
   * tier's price on the entry tier.
   */
  upstreamPlan?: string;
  /** Set once a live price has replaced the published one. */
  isLivePrice?: boolean;
  /** Shortest tenure upstream will sell, in months. */
  minTenureMonths?: number;
}

export default function PricingCard({
  plan,
  billingCycle,
  onSelect,
}: {
  plan: PlanData;
  billingCycle: 'monthly' | 'annual';
  onSelect?: (plan: PlanData) => void;
}) {
  const { formatPrice } = useCurrency();
  const { addItem } = useCart();

  const activePrice = billingCycle === 'annual' ? plan.usdAnnualMonthly : plan.usdMonthly;

  return (
    <div className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
      {plan.popular && <span className="card-ribbon">Most Popular</span>}
      <div className="plan-header">
        <h3 className="plan-name">{plan.name}</h3>
        <p className="plan-desc">{plan.desc}</p>
        <div className="plan-price-wrap">
          <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0F172A' }}>
            {formatPrice(activePrice)}
          </span>
          <span className="plan-period">
            /mo {billingCycle === 'annual' ? '(billed annually)' : ''}
          </span>
        </div>
      </div>

      <ul className="feature-list">
        {plan.features.map((feat, idx) => (
          <li key={idx} className="feature-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span dangerouslySetInnerHTML={{ __html: feat }} />
          </li>
        ))}
      </ul>

      <button
        onClick={() => {
          if (onSelect) {
            onSelect(plan);
          } else {
            addItem({
              type: 'HOSTING',
              productType: plan.productType || 'SHARED_LINUX',
              name: plan.name,
              upstreamPlan: plan.upstreamPlan,
              billingPeriod: billingCycle,
              priceMonthly: plan.usdMonthly,
              priceAnnual: Number((plan.usdAnnualMonthly * 12).toFixed(2)),
            }, true);
          }
        }}
        className={`btn ${plan.popular ? 'btn-primary' : 'btn-outline'}`}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        Get Started Now →
      </button>
    </div>
  );
}
