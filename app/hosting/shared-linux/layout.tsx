import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'cPanel Linux Web Hosting — High-Speed Cloud SSD',
  description: 'Reliable Linux cPanel shared hosting with unlimited free SSL, 1-click script installers, unmetered bandwidth, and 99.9% uptime guarantee.',
  path: '/hosting/shared-linux',
  category: 'WEB HOSTING',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
