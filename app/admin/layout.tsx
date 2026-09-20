import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Staff Operations & Infrastructure Console',
  description: 'Hostmattic internal staff administration, order processing, and reseller controls.',
  path: '/admin',
  category: 'ADMIN CONSOLE',
  noIndex: true,
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
