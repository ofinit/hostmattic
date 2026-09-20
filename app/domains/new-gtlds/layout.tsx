import React from 'react';
import { Metadata } from 'next';
import { constructMetadata } from '@/lib/metadata';

export const metadata: Metadata = constructMetadata({
  title: 'New gTLD Domain Extensions — Modern Brand Identity',
  description: 'Stand out with cutting-edge new domain extensions including .tech, .online, .store, .agency, and .app for modern startups and developers.',
  path: '/domains/new-gtlds',
  category: 'DOMAINS & DNS',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}
