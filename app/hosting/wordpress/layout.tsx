import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Managed WordPress Hosting — Blazing Fast & Secure',
  description: 'WordPress cloud hosting optimized with LiteSpeed server caching, automated core updates, staging environments, and daily backups.',
  path: '/hosting/wordpress',
  category: 'WORDPRESS',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
