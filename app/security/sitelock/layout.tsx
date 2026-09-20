import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'SiteLock Website Security — Malware Detection & Firewall',
  description: 'Comprehensive website defense with daily malware scans, automatic vulnerability patching, web application firewall (WAF), and DDoS protection.',
  path: '/security/sitelock',
  category: 'SECURITY',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
