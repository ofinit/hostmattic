import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Google Workspace — Gmail, Docs, Drive & Cloud Collaboration',
  description: 'Official Google Workspace partner plans with professional Gmail, 30GB+ cloud drive storage, Google Meet, and administrative compliance.',
  path: '/email/google-workspace',
  category: 'PRODUCTIVITY',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
