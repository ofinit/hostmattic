import { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hostmattic.com';

interface ConstructMetadataProps {
  title: string;
  description: string;
  path?: string;
  category?: string;
  image?: string;
  noIndex?: boolean;
}

export function constructMetadata({
  title,
  description,
  path = '',
  category = 'CLOUD HOSTING',
  image,
  noIndex = false,
}: ConstructMetadataProps): Metadata {
  const fullTitle = title.includes('Hostmattic') ? title : `${title} | Hostmattic`;
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const ogImageUrl =
    image ||
    `${BASE_URL}/api/og?title=${encodeURIComponent(title)}&category=${encodeURIComponent(category)}&description=${encodeURIComponent(description)}`;

  return {
    title: fullTitle,
    description,
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: 'Hostmattic',
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${title} — Hostmattic`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImageUrl],
      creator: '@hostmattic',
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, 'max-image-preview': 'large' },
  };
}
