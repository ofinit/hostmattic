import type { Metadata } from 'next';
import Link from 'next/link';
import { getBusinessIdentity, POLICY_LAST_UPDATED } from '@/lib/legal/identity';
import { LegalPage, LegalSection, IdentityBlock } from '@/components/legal/LegalPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Terms of Service | Hostmattic',
  description: 'The terms on which Hostmattic provides domains, hosting and related services.',
};

export default async function TermsPage() {
  const identity = await getBusinessIdentity();

  return (
    <LegalPage
      title="Terms of Service"
      intro="The terms on which we provide domains, hosting and related services."
      lastUpdated={POLICY_LAST_UPDATED}
      identity={identity}
    >
      <LegalSection title="Who you are contracting with">
        <IdentityBlock identity={identity} />
        <p style={{ marginTop: '12px' }}>
          Placing an order means you accept these terms. If you are ordering for a company, you confirm
          you are authorised to accept them on its behalf.
        </p>
      </LegalSection>

      <LegalSection title="What we are, and what that means for you">
        <p>
          We are a reseller. Domains are registered through an upstream registrar with the registry
          that operates each extension, and hosting runs on infrastructure we buy. The practical
          consequence is that some things are governed by rules we do not set: registry policies,
          ICANN requirements for generic extensions, and the .IN registry's rules for Indian ones.
          Where such a rule conflicts with what we have promised you, the registry's rule prevails,
          because it is the registry and not us that can act on the domain.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          Keep your password to yourself and your email address current. Renewal notices and
          registry-mandated verification messages go to that address, and a domain can be suspended by
          the registry if a verification message is ignored. You are responsible for what is done
          through your account.
        </p>
      </LegalSection>

      <LegalSection title="Domains">
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>
            Registrant details must be accurate. Registries require this, and knowingly false details
            are grounds for a registry to suspend or cancel the domain.
          </li>
          <li style={{ marginTop: '6px' }}>
            A registration lasts the term you bought. Renewal is your responsibility; we send reminders
            as a courtesy, and a reminder that fails to arrive does not extend the term.
          </li>
          <li style={{ marginTop: '6px' }}>
            Once a domain expires it may enter a redemption period during which the registry charges a
            substantially higher fee to restore it — often several times the renewal price. After that
            it is released and anyone may register it.
          </li>
          <li style={{ marginTop: '6px' }}>
            A transfer in requires the domain to be unlocked at its current registrar and takes up to
            five days, which is the registry's window and not ours. Transfers out are not obstructed.
          </li>
          <li style={{ marginTop: '6px' }}>
            Availability shown at search time is the registry's answer at that moment. A domain can be
            taken by someone else between the search and the payment; where that happens the order
            cannot complete and you are refunded in full.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Hosting and acceptable use">
        <p>You may not use the services to:</p>
        <ul style={{ margin: '10px 0 0', paddingLeft: '20px' }}>
          <li>send unsolicited bulk email, or host anything advertised by it;</li>
          <li style={{ marginTop: '4px' }}>
            distribute malware, run phishing pages, or host content designed to deceive people about
            who they are dealing with;
          </li>
          <li style={{ marginTop: '4px' }}>
            infringe someone else's intellectual property, or publish material that is unlawful where
            it is published;
          </li>
          <li style={{ marginTop: '4px' }}>
            attack other systems, or consume shared resources so heavily that other customers on the
            same server are affected.
          </li>
        </ul>
        <p style={{ marginTop: '12px' }}>
          Where we must suspend a service for one of these reasons, we will tell you why and what would
          resolve it. We suspend without notice only where leaving it running would cause ongoing harm
          to others — an active phishing page, or an outbound attack.
        </p>
      </LegalSection>

      <LegalSection title="Prices, payment and tax">
        <p>
          Prices are shown before you pay, in the currency you selected. Rupee prices include GST at
          the applicable rate; the tax is itemised on the invoice we issue. Prices for a term are fixed
          for that term, but renewal is priced at the rate current when the renewal falls due —
          registries change their own prices, and a promotional first-year rate does not carry into a
          renewal.
        </p>
        <p style={{ marginTop: '10px' }}>
          A service is provided once payment has cleared. If a payment is reversed after a service has
          been provisioned, we may suspend it until the position is resolved.
        </p>
      </LegalSection>

      <LegalSection title="Cancellation and refunds">
        <p>
          Set out separately on the{' '}
          <Link href="/legal/refunds" style={{ color: '#10708A' }}>
            Refunds &amp; Cancellations
          </Link>{' '}
          page, which forms part of these terms. In short: domain fees are paid to the registry
          immediately and cannot be refunded, and we refund in full anything we fail to deliver.
        </p>
      </LegalSection>

      <LegalSection title="Availability, backups and liability">
        <p>
          We work to keep services running and to resolve faults promptly, but no hosting is immune to
          failure. <strong>Keep your own backups of anything you cannot afford to lose.</strong> Any
          backup facility we provide is a convenience, not a substitute for your own copy, and you
          should not assume a restore will be available at the moment you need it.
        </p>
        <p style={{ marginTop: '10px' }}>
          Except where the law does not allow it to be limited, our liability for any claim relating to
          a service is limited to the amount you paid us for that service in the twelve months before
          the claim. We are not liable for lost profits or lost data as an indirect consequence of a
          fault.
        </p>
      </LegalSection>

      <LegalSection title="Suspension and termination">
        <p>
          You may stop using the services at any time; cancelling prevents the next renewal. We may
          suspend or end a service for non-payment, for a breach of the acceptable use rules above, or
          where a registry or supplier requires it. Where we end a service other than for your breach,
          we refund the unused portion of anything refundable.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          These terms may change. The date at the top of this page changes when they do, and material
          changes are notified by email. Continuing to use the services after a change means you accept
          it; if you do not, you may cancel.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These terms are governed by the law of India, and the courts of{' '}
          {identity.state ? <>{identity.state}</> : <>the state in which we are registered</>} have
          jurisdiction over any dispute. Nothing here removes a right you have under consumer law that
          cannot be excluded by agreement.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
