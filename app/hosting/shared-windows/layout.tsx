import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Windows ASP.NET Web Hosting — Plesk Powered',
  description: 'Optimized Windows hosting powered by Plesk Obsidian, Microsoft SQL Server 2019, ASP.NET Core, and IIS 10 for enterprise .NET applications.',
  path: '/hosting/shared-windows',
  category: 'WEB HOSTING',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
