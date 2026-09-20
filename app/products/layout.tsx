import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'All Products & Cloud Infrastructure Services Catalog',
  description: 'Explore Hostmattic complete catalog of domain registrations, web hosting, NVMe VPS, dedicated servers, business email, and security suites.',
  path: '/products',
  category: 'CATALOG',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
