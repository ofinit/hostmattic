import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'cPanel Reseller Hosting — Launch Your Hosting Brand',
  description: 'White-label cPanel / WHM reseller hosting with private nameservers, unlimited cPanel accounts, free SSL, and high-performance server clusters.',
  path: '/hosting/reseller',
  category: 'RESELLER',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
