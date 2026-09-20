import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get('title') || 'Enterprise Cloud Hosting & Infrastructure';
    const category = searchParams.get('category') || 'CLOUD HOSTING';
    const description = searchParams.get('description') || 'High-performance cloud hosting, NVMe VPS, dedicated bare-metal servers, and domain registrations.';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: '#090D12',
            padding: '60px 70px',
            fontFamily: 'sans-serif',
            position: 'relative',
          }}
        >
          {/* Subtle background glow */}
          <div
            style={{
              position: 'absolute',
              top: '-150px',
              right: '-100px',
              width: '600px',
              height: '600px',
              borderRadius: '999px',
              background: 'radial-gradient(circle, rgba(155,203,68,0.15) 0%, rgba(41,180,213,0.08) 50%, rgba(9,13,18,0) 80%)',
            }}
          />

          {/* Top Bar: Brand Logo + Category Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '54px',
                  height: '54px',
                  borderRadius: '14px',
                  backgroundColor: '#1E293B',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                {/* SVG Padlock / Server Icon */}
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9BCB44" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.03em' }}>
                  Hostmattic
                </span>
                <span style={{ fontSize: '14px', color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Enterprise Cloud Infrastructure
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '999px',
                background: 'rgba(155,203,68,0.15)',
                border: '1px solid rgba(155,203,68,0.35)',
                color: '#9BCB44',
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '999px', background: '#9BCB44' }} />
              {category}
            </div>
          </div>

          {/* Main Hero Section: Title & Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', marginTop: '20px' }}>
            <h1
              style={{
                fontSize: title.length > 35 ? '52px' : '62px',
                fontWeight: 900,
                color: '#FFFFFF',
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                margin: 0,
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: '24px',
                color: '#94A3B8',
                lineHeight: 1.45,
                margin: 0,
                maxWidth: '920px',
              }}
            >
              {description}
            </p>
          </div>

          {/* Footer Bar: Trust Indicators & URL */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              paddingTop: '24px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#CBD5E1', fontSize: '16px' }}>
                <span style={{ color: '#9BCB44', fontWeight: 800 }}>✓</span> 99.99% Uptime SLA
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#CBD5E1', fontSize: '16px' }}>
                <span style={{ color: '#29B4D5', fontWeight: 800 }}>⚡</span> NVMe Powered
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#CBD5E1', fontSize: '16px' }}>
                <span style={{ color: '#FFCD00', fontWeight: 800 }}>🛡️</span> Enterprise DDoS Protection
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#64748B', fontSize: '16px' }}>hostmattic.com</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response(`Failed to generate OG image: ${e.message}`, { status: 500 });
  }
}
