import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Enterprise Business Email — Custom Domain Mailboxes',
  description: 'Professional domain-branded business email with Webmail, IMAP/POP3, active anti-spam, and cross-device synchronization.',
  path: '/email/business',
  category: 'BUSINESS EMAIL',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
