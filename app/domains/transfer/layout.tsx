import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Domain Transfer — Move Your Domains Seamlessly',
  description: 'Transfer your domain to Hostmattic with zero downtime, an automatic 1-year renewal extension, free DNS management, and 24/7 technical concierge.',
  path: '/domains/transfer',
  category: 'DOMAINS & DNS',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
