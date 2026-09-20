import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Secure Checkout — Fast Cloud Provisioning',
  description: 'Complete your order securely with instant automated provisioning, 0% fee UPI, and international credit cards.',
  path: '/checkout',
  category: 'CHECKOUT',
  noIndex: true,
});

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
