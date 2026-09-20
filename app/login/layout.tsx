import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Client Portal Login — Manage Your Services',
  description: 'Securely access your Hostmattic customer portal, manage active domains, launch cPanel SSO, and view billing invoices.',
  path: '/login',
  category: 'CLIENT PORTAL',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
