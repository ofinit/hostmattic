import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'NVMe Linux KVM VPS — Root Access & Dedicated Resources',
  description: 'High-performance KVM virtual private servers with pure NVMe SSD storage, 1Gbps unmetered network ports, guaranteed RAM/vCPU, and root control.',
  path: '/servers/vps',
  category: 'CLOUD SERVERS',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
