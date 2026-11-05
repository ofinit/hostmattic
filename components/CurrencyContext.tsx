'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { FALLBACK_USD_INR_RATE } from '@/lib/pricing/fx';

export type Currency = 'USD' | 'INR';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatPrice: (usdPrice: number) => string;
  symbol: string;
  rate: number;
  isLocked: boolean;
  lockedCurrency: Currency | null;
  setAccountLock: (c: Currency | null) => void;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'USD',
  setCurrency: () => {},
  formatPrice: (p) => `$${p.toFixed(2)}`,
  symbol: '$',
  rate: FALLBACK_USD_INR_RATE,
  isLocked: false,
  lockedCurrency: null,
  setAccountLock: () => {},
});

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrencyState] = useState<Currency>('USD');
  const [lockedCurrency, setLockedCurrency] = useState<Currency | null>(null);
  // Fetched once from the server, which holds the one rate. Starting from the
  // shared fallback means a failed fetch behaves exactly as before rather than
  // pricing everything at zero.
  const [rate, setRate] = useState<number>(FALLBACK_USD_INR_RATE);

  // Check saved preferences and query server for account-level lock
  useEffect(() => {
    // Take the rate from the server rather than keeping a second copy here.
    // A failure is not an error state: the seeded fallback is the same number
    // this file used to hardcode, so prices still render.
    fetch('/api/fx')
      .then((res) => res.json())
      .then((d) => {
        if (d?.success && typeof d.rate === 'number' && d.rate > 0) setRate(d.rate);
      })
      .catch(() => {});

    const saved = localStorage.getItem('hm_currency') as Currency;
    if (saved === 'USD' || saved === 'INR') {
      setCurrencyState(saved);
    }

    // Check if authenticated user has a currency lock
    fetch('/api/client/currency-status')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.isLocked && data?.lockedCurrency) {
          setLockedCurrency(data.lockedCurrency);
          setCurrencyState(data.lockedCurrency);
          localStorage.setItem('hm_currency', data.lockedCurrency);
        }
      })
      .catch(() => {});
  }, []);

  const setAccountLock = useCallback((c: Currency | null) => {
    setLockedCurrency(c);
    if (c) {
      setCurrencyState(c);
      localStorage.setItem('hm_currency', c);
    }
  }, []);

  const setCurrency = (c: Currency) => {
    // If account has an active lock, do not permit cross-currency toggle
    if (lockedCurrency && lockedCurrency !== c) {
      console.warn(`[CurrencyContext] Currency change blocked: account is locked to ${lockedCurrency}`);
      return;
    }
    setCurrencyState(c);
    localStorage.setItem('hm_currency', c);
  };

  const symbol = currency === 'USD' ? '$' : '₹';

  const formatPrice = (usdPrice: number) => {
    if (currency === 'USD') {
      return `$${usdPrice.toFixed(2)}`;
    } else {
      const inr = Math.round(usdPrice * rate);
      return `₹${inr.toLocaleString('en-IN')}`;
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        formatPrice,
        symbol,
        rate,
        isLocked: Boolean(lockedCurrency),
        lockedCurrency,
        setAccountLock,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);

