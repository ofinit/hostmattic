'use client';

import { useEffect, useState } from 'react';

/**
 * Overlays live upstream plan pricing onto a page's published plans.
 *
 * Every product page outside domains carried its prices in the source, so a
 * cost change upstream stayed invisible until someone checked the margin by
 * hand. This hook fetches the live figures for one product family and merges
 * them in by plan name.
 *
 * The merge is deliberately one-directional and partial: a plan with no live
 * match keeps exactly the figures the page shipped with. The page therefore
 * renders correctly before the fetch resolves, when upstream is unreachable,
 * and when a plan simply is not sold upstream - and it never shows a number
 * this app made up.
 */
export interface LivePlanPrice {
  monthlyUsd?: number;
  annualMonthlyUsd?: number;
  annualUsd?: number;
}

const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');

export function useLivePlanPricing<
  T extends { name: string; usdMonthly: number; usdAnnualMonthly: number }
>(publishedPlans: T[], productType: string): { plans: T[]; isLive: boolean } {
  const [plans, setPlans] = useState<T[]>(publishedPlans);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/hosting/pricing?type=${encodeURIComponent(productType)}`)
      .then(async (res) => {
        // Defensive: an upstream timeout can return an HTML error page, and
        // res.json() on that throws "Unexpected end of JSON input".
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
        const entries = Object.entries(live);
        if (!entries.length) return;

        let matched = false;
        const merged = publishedPlans.map((plan) => {
          const hit = entries.find(([k]) => norm(k) === norm(plan.name));
          if (!hit) return plan;
          const p = hit[1];
          if (p.monthlyUsd == null && p.annualMonthlyUsd == null) return plan;
          matched = true;
          return {
            ...plan,
            usdMonthly: p.monthlyUsd ?? plan.usdMonthly,
            usdAnnualMonthly: p.annualMonthlyUsd ?? plan.usdAnnualMonthly,
          };
        });

        if (matched) {
          setPlans(merged);
          setIsLive(true);
        }
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
