import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Elastic Cloud Hosting — 4x Faster Speeds & Dedicated RAM',
  description: 'Supercharged cloud hosting with dedicated CPU cores, RAM allocations, automatic failover, and instantaneous one-click resource scaling.',
  path: '/hosting/cloud',
  category: 'CLOUD HOSTING',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
