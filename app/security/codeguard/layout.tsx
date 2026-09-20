import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'CodeGuard Website Backup — Daily Automated Cloud Snapshots',
  description: 'Automated off-site cloud backups with daily website change monitoring, version history, and one-click automatic disaster recovery.',
  path: '/security/codeguard',
  category: 'BACKUP',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
