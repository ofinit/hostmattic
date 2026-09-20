import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Dedicated Bare-Metal Servers — Raw Enterprise Compute',
  description: 'Single-tenant bare-metal enterprise servers with Intel Xeon / AMD EPYC processors, hardware RAID, IPMI out-of-band console, and Tier-IV datacenter security.',
  path: '/servers/dedicated',
  category: 'DEDICATED SERVERS',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
