import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'Drag & Drop Website Builder — Launch in Minutes',
  description: 'Intuitive no-code website builder with 200+ responsive designer templates, built-in e-commerce, and instant mobile optimization.',
  path: '/tools/website-builder',
  category: 'WEB TOOLS',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
