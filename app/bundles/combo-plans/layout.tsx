import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Cloud Combo Plans — Domain + Hosting + Email in One',
  description: 'All-inclusive digital launch packs combining custom domain registration, cloud hosting, and professional business email at maximum savings.',
  path: '/bundles/combo-plans',
  category: 'BUNDLES',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
