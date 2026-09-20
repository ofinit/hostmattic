import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Create Your Account — Join Hostmattic',
  description: 'Sign up for instant cloud provisioning, centralized domain delegation, 24/7 technical support desk, and enterprise hosting management.',
  path: '/register',
  category: 'CLIENT PORTAL',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
