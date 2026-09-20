import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Domain Name Registration — Search & Register 800+ TLDs',
  description: 'Search, register, and protect your domain with instant DNS setup, theft protection lock, and competitive pricing across .com, .in, .org, and 800+ extensions.',
  path: '/domains',
  category: 'DOMAINS & DNS',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
