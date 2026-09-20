import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Sectigo SSL Certificates — 256-bit Encryption & Site Seal',
  description: 'Industry-standard SSL certificates with instant issuance, SHA-256 bit encryption, trust seal, and 99.9% browser compatibility.',
  path: '/security/ssl',
  category: 'SECURITY',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
