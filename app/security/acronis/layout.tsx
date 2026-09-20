import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Acronis Cyber Backup — Enterprise Cloud Disaster Recovery',
  description: 'Military-grade Acronis cloud data protection with automated endpoint backups, ransomware defense, and instant bare-metal restore.',
  path: '/security/acronis',
  category: 'BACKUP',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
