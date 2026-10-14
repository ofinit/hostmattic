'use client';

import { useEffect, useState } from 'react';

/**
 * Overlays live upstream plan pricing onto a page's published plans.
 *
 * Every product family outside domains carried its prices in the page source,
 * so a cost change upstream stayed invisible until someone checked the margin
 * by hand. This fetches the live figures for one family and merges them in.
 *
 * The merge is partial and one-directional by design. A plan keeps exactly the
 * figures the page shipped with unless a live price is found for the upstream
 * plan it names. So the page renders correctly before the fetch resolves, when
 * upstream is unreachable, and when a tier is not sold upstream at all - and it
 * never shows a number this app invented.
 *
 * Matching is on `upstreamPlan`, never on position. Upstream names its tiers
 * Economy / Standard / Advanced while the storefront sells Starter /
 * Performance / Business Pro; lining them up by order would put the top tier's
 * price on the entry tier.
 */
export interface LivePlanPrice {
  monthlyUsd?: number;
  annualMonthlyUsd?: number;
  renewMonthlyUsd?: number;
  minTenureMonths?: number;
  status?: string;
}

interface Mergeable {
  name: string;
  usdMonthly: number;
  usdAnnualMonthly: number;
  upstreamPlan?: string;
  isLivePrice?: boolean;
  minTenureMonths?: number;
}

export function useLivePlanPricing<T extends Mergeable>(
  publishedPlans: T[],
  productType: string
): { plans: T[]; isLive: boolean } {
  const [plans, setPlans] = useState<T[]>(publishedPlans);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/hosting/pricing?type=${encodeURIComponent(productType)}`)
      .then(async (res) => {
        // An upstream timeout can return an HTML error page, and res.json()
        // on that throws "Unexpected end of JSON input".
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })
      .then((json) => {
        if (cancelled || !json?.success || !json.plans) return;

        const live = json.plans as Record<string, LivePlanPrice>;
        if (!Object.keys(live).length) return;

        // Two tiers naming the same upstream plan is a mapping mistake: both
        // would take the same price and one of them is certainly wrong. There
        // is no safe way to pick, so apply nothing.
        const claimed = publishedPlans.map((p) => p.upstreamPlan).filter(Boolean) as string[];
        const duplicated = claimed.filter((v, i) => claimed.indexOf(v) !== i);
        if (duplicated.length) {
          console.warn(
            `[LivePricing] ${productType}: more than one tier maps to ` +
              `${Array.from(new Set(duplicated)).join(', ')}. Keeping published prices.`
          );
          return;
        }

        const usable = (v: unknown): v is number =>
          typeof v === 'number' && Number.isFinite(v) && v > 0;

        let matched = false;
        const merged = publishedPlans.map((plan) => {
          if (!plan.upstreamPlan) return plan;
          const p = live[plan.upstreamPlan];
          if (!p) return plan;

          // Upstream does not always sell a one-month tenure. Where it does
          // not, the monthly figure stays as published rather than silently
          // showing an annual-commitment rate as a month-to-month price.
          const monthly = usable(p.monthlyUsd) ? p.monthlyUsd : plan.usdMonthly;
          const annualMonthly = usable(p.annualMonthlyUsd)
            ? p.annualMonthlyUsd
            : plan.usdAnnualMonthly;
          if (monthly === plan.usdMonthly && annualMonthly === plan.usdAnnualMonthly) {
            return plan;
          }

          matched = true;
          return {
            ...plan,
            usdMonthly: monthly,
            usdAnnualMonthly: annualMonthly,
            isLivePrice: true,
            minTenureMonths: p.minTenureMonths,
          };
        });

        if (!matched) return;

        // The page lists tiers cheapest first. If the live figures would make a
        // higher tier cost less than a lower one, the catalogue upstream is
        // misconfigured, and publishing it would show visitors a mid tier
        // priced below the entry tier. Keep the published set and say so
        // rather than render a storefront that reads as broken.
        const annual = merged.map((p) => p.usdAnnualMonthly);
        const monthlyRates = merged.map((p) => p.usdMonthly);
        const isInverted = (xs: number[]) => xs.some((v, i) => i > 0 && v < xs[i - 1]);

        // Every figure must still be a usable number after the merge; a NaN or
        // a zero would render as a free plan.
        if (![...annual, ...monthlyRates].every(usable)) {
          console.warn(
            `[LivePricing] ${productType}: merged prices contain an unusable value. ` +
              'Keeping published prices.'
          );
          return;
        }

        if (isInverted(annual) || isInverted(monthlyRates)) {
          console.warn(
            `[LivePricing] ${productType}: upstream prices are not ordered by tier ` +
              `(annual ${annual.join(' -> ')}; monthly ${monthlyRates.join(' -> ')}). ` +
              'Keeping published prices. Fix the plan prices in the reseller control panel.'
          );
          return;
        }

        setPlans(merged);
        setIsLive(true);
      })
      .catch(() => {
        // Keep the published prices; nothing to report to the visitor.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productType]);

  return { plans, isLive };
}
