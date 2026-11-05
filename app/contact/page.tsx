import type { Metadata } from 'next';
import Link from 'next/link';
import { getBusinessIdentity, POLICY_LAST_UPDATED } from '@/lib/legal/identity';
import { LegalPage, LegalSection, MissingFact } from '@/components/legal/LegalPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contact Us | Hostmattic',
  description: 'How to reach Hostmattic about an order, a service or an account.',
};

export default async function ContactPage() {
  const identity = await getBusinessIdentity();

  return (
    <LegalPage
      title="Contact Us"
      intro="How to reach a person about an order, a service or your account."
      lastUpdated={POLICY_LAST_UPDATED}
      identity={identity}
    >
      <LegalSection title="If you already have an account">
        <p>
          Raise a ticket from{' '}
          <Link href="/client/dashboard" style={{ color: '#10708A' }}>
            your control panel
          </Link>
          . That is the fastest route, because the ticket arrives attached to your account and the
          services on it — nobody has to ask you which domain you mean.
        </p>
        <p style={{ marginTop: '10px' }}>
          If your question is about a specific order, quote the invoice number from the document we
          issued. It identifies the order exactly.
        </p>
      </LegalSection>

      <LegalSection title="By email">
        {identity.supportEmail ? (
          <p>
            <a
              href={`mailto:${identity.supportEmail}`}
              style={{ color: '#10708A', fontWeight: 700, fontSize: '1.05rem' }}
            >
              {identity.supportEmail}
            </a>
          </p>
        ) : (
          <p>
            <MissingFact what="Support email" />
            <br />
            <span style={{ display: 'inline-block', marginTop: '8px' }}>
              No support address has been published yet. In the meantime, customers can reach us by
              raising a ticket from the control panel, which is monitored.
            </span>
          </p>
        )}
        {identity.supportHours && (
          <p style={{ marginTop: '10px', color: '#64748B' }}>Hours: {identity.supportHours}</p>
        )}
      </LegalSection>

      {identity.supportPhone && (
        <LegalSection title="By phone">
          <p style={{ fontWeight: 700, fontSize: '1.05rem' }}>{identity.supportPhone}</p>
        </LegalSection>
      )}

      <LegalSection title="Registered office">
        <div style={{ lineHeight: 1.75 }}>
          <div>
            <strong>{identity.legalName ?? <MissingFact what="Registered business name" />}</strong>
          </div>
          <div>{identity.address ?? <MissingFact what="Registered address" />}</div>
          {identity.gstin && <div style={{ marginTop: '6px' }}>GSTIN: {identity.gstin}</div>}
        </div>
        <p style={{ marginTop: '12px', color: '#64748B', fontSize: '0.88rem' }}>
          This is our registered address for correspondence and statutory purposes. It is not a walk-in
          support desk — email or a ticket will always be answered sooner.
        </p>
      </LegalSection>

      <LegalSection title="Reporting abuse">
        <p>
          If a domain or site we host is being used for phishing, malware or spam, tell us and include
          the domain name and any evidence you have — a message header, a URL, a timestamp. Reports
          that identify the specific resource are acted on much faster than general complaints. We
          suspend without notice where leaving something running would cause ongoing harm.
        </p>
      </LegalSection>

      <LegalSection title="Data protection requests">
        <p>
          Requests to access, correct or delete personal data go to the same address. What we can and
          cannot action is set out in the{' '}
          <Link href="/legal/privacy" style={{ color: '#10708A' }}>
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
