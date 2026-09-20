import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Client Dashboard & Cloud Control Panel',
  description: 'Manage your active domains, hosting servers, DNS zones, and invoices.',
  path: '/client/dashboard',
  category: 'CLIENT PORTAL',
  noIndex: true,
});

export default function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
