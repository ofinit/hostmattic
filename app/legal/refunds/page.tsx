import type { Metadata } from 'next';
import Link from 'next/link';
import { getBusinessIdentity, POLICY_LAST_UPDATED } from '@/lib/legal/identity';
import { LegalPage, LegalSection, MissingFact, IdentityBlock } from '@/components/legal/LegalPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Refunds & Cancellations | Hostmattic',
  description: 'When a Hostmattic service can be cancelled or refunded, and when it cannot.',
};

export default async function RefundsPage() {
  const identity = await getBusinessIdentity();

  return (
    <LegalPage
      title="Refunds & Cancellations"
      intro="What can be cancelled, what cannot, and why."
      lastUpdated={POLICY_LAST_UPDATED}
      identity={identity}
    >
      <LegalSection title="Domain registrations, renewals and transfers are not refundable">
        <p>
          This is not a commercial preference. When you register, renew or transfer a domain, the fee is
          paid immediately to the registry that operates the extension, and that payment cannot be
          reversed by us. The domain is yours for the term you bought regardless of whether you use it,
          and we cannot recover the registry fee in order to return it to you.
        </p>
        <p style={{ marginTop: '10px' }}>
          Two consequences worth knowing before you buy: a domain registered by mistake — a typo in the
          name, the wrong extension — cannot be refunded, and cancelling auto-renew does not refund a
          renewal that has already been taken. Check the spelling on the confirmation screen; it is the
          last point at which a mistake costs nothing.
        </p>
      </LegalSection>

      <LegalSection title="Hosting and other recurring services">
        {identity.refundWindowDays ? (
          <p>
            A hosting plan may be cancelled for a full refund within{' '}
            <strong>{identity.refundWindowDays} days</strong> of the date it was first purchased. After
            that period the current term is not refundable, but you can cancel at any time to prevent
            the next renewal.
          </p>
        ) : (
          <p>
            <MissingFact what="Refund window for hosting" />
            <br />
            <span style={{ display: 'inline-block', marginTop: '8px' }}>
              No refund period has been published for hosting services yet. Until one is, please contact
              us before purchasing if a refund window matters to your decision, and we will tell you in
              writing what applies to your order.
            </span>
          </p>
        )}
        <p style={{ marginTop: '10px' }}>
          Where a plan includes a domain registration, the domain portion follows the rule above and is
          deducted from any refund, because that cost has already been paid to the registry.
        </p>
      </LegalSection>

      <LegalSection title="Services set up specifically for you">
        <p>
          SSL certificates, licences and similar items are issued by a third party against your details
          at the moment of purchase. Once issued they cannot be returned, so they are not refundable.
          Where such an item has been paid for but not yet issued, it can be cancelled in full.
        </p>
      </LegalSection>

      <LegalSection title="If we cannot deliver">
        <p>
          If you pay for a service and we are unable to provide it — a registration the registry
          refuses, a plan we cannot provision — you are refunded in full. That applies regardless of
          anything above, and you do not need to ask within any window. If this has happened to your
          order, tell us and we will confirm the position in writing.
        </p>
      </LegalSection>

      <LegalSection title="How to request a cancellation or refund">
        <p>
          Raise a ticket from{' '}
          <Link href="/client/dashboard" style={{ color: '#10708A' }}>
            your control panel
          </Link>
          , or write to us. Quote the invoice number from the document we issued — it identifies the
          order precisely.
        </p>
        <div style={{ marginTop: '14px' }}>
          <IdentityBlock identity={identity} />
        </div>
      </LegalSection>

      <LegalSection title="Your statutory rights">
        <p>
          Nothing on this page limits any right you have under applicable consumer law. Where such a
          right conflicts with anything written here, the law applies and this page does not.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
