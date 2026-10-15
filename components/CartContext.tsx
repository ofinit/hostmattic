'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  id: string;
  type: 'DOMAIN' | 'HOSTING' | 'SERVER' | 'EMAIL' | 'SECURITY' | 'BUNDLE';
  productType?: string;
  name: string;
  domainName?: string;
  billingPeriod: 'monthly' | 'annual';
  priceMonthly: number;
  priceAnnual: number;
  quantity?: number;
  /**
   * The plan's name in the upstream catalogue. The `name` above is a marketing
   * label ("WP Starter") that upstream has never heard of, so checkout needs
   * this to price and provision the line.
   */
  upstreamPlan?: string;
  /** EPP authorisation code for a domain transfer. */
  authCode?: string;
  /** Registration or transfer term, in years. */
  years?: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'> & { id?: string }, autoOpen?: boolean) => void;
  removeItem: (id: string) => void;
  updateItemCycle: (id: string, cycle: 'monthly' | 'annual') => void;
  /** Correct a line to the authoritative price returned by checkout. */
  updateItemPrice: (id: string, prices: { priceMonthly?: number; priceAnnual?: number }) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  cartCount: number;
  totalUsd: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('hm_cart');
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Could not read cart from localStorage', e);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem('hm_cart', JSON.stringify(items));
      } catch (e) {
        console.warn('Could not save cart to localStorage', e);
      }
    }
  }, [items, mounted]);

  const addItem = (item: Omit<CartItem, 'id'> & { id?: string }, autoOpen = true) => {
    const newItem: CartItem = {
      ...item,
      id: item.id || `${item.type}-${item.name}-${Date.now()}`,
      quantity: item.quantity || 1,
    };

    setItems((prev) => {
      // If item with same name & domain exists, don't duplicate, update cycle
      const idx = prev.findIndex(
        (i) => i.name === newItem.name && (i.domainName || '') === (newItem.domainName || '')
      );
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], billingPeriod: newItem.billingPeriod };
        return next;
      }
      return [...prev, newItem];
    });

    if (autoOpen) {
      setIsCartOpen(true);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItemPrice = (
    id: string,
    prices: { priceMonthly?: number; priceAnnual?: number }
  ) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              priceMonthly: prices.priceMonthly ?? i.priceMonthly,
              priceAnnual: prices.priceAnnual ?? i.priceAnnual,
            }
          : i
      )
    );
  };

  const updateItemCycle = (id: string, cycle: 'monthly' | 'annual') => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, billingPeriod: cycle } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem('hm_cart');
    } catch (e) {}
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const cartCount = items.reduce((acc, curr) => acc + (curr.quantity || 1), 0);

  const totalUsd = items.reduce((acc, curr) => {
    const price =
      curr.billingPeriod === 'annual' ? curr.priceAnnual : curr.priceMonthly;
    return acc + price * (curr.quantity || 1);
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateItemCycle,
        updateItemPrice,
        clearCart,
        isCartOpen,
        openCart,
        closeCart,
        cartCount,
        totalUsd,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
