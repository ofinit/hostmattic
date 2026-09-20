import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CurrencyProvider } from '@/components/CurrencyContext';
import { CartProvider } from '@/components/CartContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CheckoutDrawer from '@/components/CheckoutDrawer';

export const viewport: Viewport = {
  themeColor: '#1B2228',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://hostmattic.com'),
  title: 'Hostmattic — Domains, Websites & High-Performance Cloud Hosting',
  description:
    'Hostmattic delivers modern cloud hosting, domain registration across 800+ TLDs, NVMe VPS, dedicated bare-metal servers, business email, and SSL certificates powered by instant cloud provisioning.',
  icons: {
    icon: '/assets/img/hostmattic-logo-icon.png',
    shortcut: '/assets/img/hostmattic-logo-icon.svg',
    apple: '/assets/img/hostmattic-logo-icon.png',
  },
  openGraph: {
    title: 'Hostmattic — Domains, Websites & High-Performance Cloud Hosting',
    description:
      'Hostmattic delivers modern cloud hosting, domain registration across 800+ TLDs, NVMe VPS, dedicated bare-metal servers, business email, and SSL certificates powered by instant cloud provisioning.',
    url: 'https://hostmattic.com',
    siteName: 'Hostmattic',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/api/og?title=Enterprise+Cloud+Hosting+%26+Infrastructure&category=CLOUD+HOSTING&description=High-performance+cloud+hosting,+NVMe+VPS,+dedicated+bare-metal+servers,+and+domain+registrations.',
        width: 1200,
        height: 630,
        alt: 'Hostmattic — Enterprise Cloud Hosting & Infrastructure',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hostmattic — Domains, Websites & High-Performance Cloud Hosting',
    description:
      'Hostmattic delivers modern cloud hosting, domain registration across 800+ TLDs, NVMe VPS, dedicated bare-metal servers, business email, and SSL certificates powered by instant cloud provisioning.',
    images: [
      '/api/og?title=Enterprise+Cloud+Hosting+%26+Infrastructure&category=CLOUD+HOSTING&description=High-performance+cloud+hosting,+NVMe+VPS,+dedicated+bare-metal+servers,+and+domain+registrations.',
    ],
    creator: '@hostmattic',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="preload"
          href="/assets/img/hostmattic-logo.webp"
          as="image"
          type="image/webp"
          // @ts-ignore
          fetchpriority="high"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <CurrencyProvider>
          <CartProvider>
            <Header />
            <main>{children}</main>
            <Footer />
            <CheckoutDrawer />
          </CartProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
