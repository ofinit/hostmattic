import React from 'react';
import Link from 'next/link';
import { BusinessIdentity } from '@/lib/legal/identity';

/**
 * Shared shell for the published policy pages.
 *
 * It carries one deliberate behaviour: when a fact these documents depend on
 * has not been configured, the page SAYS SO, in place, instead of printing a
 * placeholder. A policy is a commitment a customer can hold the business to,
 * so an invented address or an assumed refund window is worse than an
 * acknowledged gap.
 */

export function MissingFact({ what }: { what: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: '#FEF3C7',
        border: '1px solid #FDE68A',
        color: '#92400E',
        padding: '1px 7px',
        borderRadius: '5px',
        fontSize: '0.85em',
        fontWeight: 700,
      }}
    >
      {what} — not yet published
    </span>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '28px' }}>
      <h2
        style={{
          fontSize: '1.15rem',
          color: '#0F172A',
          margin: '0 0 10px',
          fontWeight: 800,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      <div style={{ color: '#334155', fontSize: '0.95rem', lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

export function LegalPage({
  title,
  intro,
  lastUpdated,
  identity,
  children,
}: {
  title: string;
  intro: string;
  lastUpdated: string;
  identity: BusinessIdentity;
  children: React.ReactNode;
}) {
  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '820px' }}>
        <nav style={{ fontSize: '0.82rem', color: '#64748B', marginBottom: '14px' }}>
          <Link href="/" style={{ color: '#10708A' }}>
            Home
          </Link>
          <span style={{ margin: '0 7px' }}>/</span>
          <span>{title}</span>
        </nav>

        <h1 style={{ fontSize: '2rem', color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.02em' }}>{title}</h1>
        <p style={{ color: '#64748B', fontSize: '0.95rem', margin: '0 0 6px', lineHeight: 1.6 }}>{intro}</p>
        <p style={{ color: '#94A3B8', fontSize: '0.82rem', margin: '0 0 28px' }}>Last updated: {lastUpdated}</p>

        {/*
          One honest banner rather than a page full of silent blanks. It names
          exactly what is missing and where it is set, so the gap is closed by
          configuring the real value - never by inventing one here.
        */}
        {identity.missing.length > 0 && (
          <div
            role="status"
            style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '28px',
              color: '#92400E',
              fontSize: '0.88rem',
              lineHeight: 1.6,
            }}
          >
            <strong>This document is incomplete.</strong> The following have not been published yet, and
            are shown as gaps rather than guesses:
            <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
              {identity.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '18px',
            padding: '28px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {children}
        </div>

        <div
          style={{
            marginTop: '22px',
            display: 'flex',
            gap: '18px',
            flexWrap: 'wrap',
            fontSize: '0.85rem',
            color: '#64748B',
          }}
        >
          <Link href="/legal/terms" style={{ color: '#10708A' }}>
            Terms of Service
          </Link>
          <Link href="/legal/privacy" style={{ color: '#10708A' }}>
            Privacy Policy
          </Link>
          <Link href="/legal/refunds" style={{ color: '#10708A' }}>
            Refunds &amp; Cancellations
          </Link>
          <Link href="/contact" style={{ color: '#10708A' }}>
            Contact
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Renders the business's identity block, gaps included. */
export function IdentityBlock({ identity }: { identity: BusinessIdentity }) {
  return (
    <div style={{ fontSize: '0.92rem', lineHeight: 1.75, color: '#334155' }}>
      <div>
        <strong>{identity.legalName ?? <MissingFact what="Registered business name" />}</strong>
      </div>
      <div>{identity.address ?? <MissingFact what="Registered address" />}</div>
      {identity.gstin && <div>GSTIN: {identity.gstin}</div>}
      {identity.pan && <div>PAN: {identity.pan}</div>}
      <div style={{ marginTop: '8px' }}>
        {identity.supportEmail ? (
          <a href={`mailto:${identity.supportEmail}`} style={{ color: '#10708A' }}>
            {identity.supportEmail}
          </a>
        ) : (
          <MissingFact what="Support email" />
        )}
      </div>
      {identity.supportPhone && <div>{identity.supportPhone}</div>}
    </div>
  );
}
