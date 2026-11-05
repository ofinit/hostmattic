import type { Metadata } from 'next';
import { getBusinessIdentity, POLICY_LAST_UPDATED } from '@/lib/legal/identity';
import { LegalPage, LegalSection, IdentityBlock, MissingFact } from '@/components/legal/LegalPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Privacy Policy | Hostmattic',
  description: 'What Hostmattic collects, why, who it is shared with, and what you can ask us to do with it.',
};

export default async function PrivacyPage() {
  const identity = await getBusinessIdentity();

  return (
    <LegalPage
      title="Privacy Policy"
      intro="What we collect, why we need it, and who else sees it."
      lastUpdated={POLICY_LAST_UPDATED}
      identity={identity}
    >
      <LegalSection title="Who is responsible for your data">
        <IdentityBlock identity={identity} />
        <p style={{ marginTop: '14px' }}>
          Under India's Digital Personal Data Protection Act, 2023 we are the{' '}
          <strong>Data Fiduciary</strong> for the personal data described here, and you are the{' '}
          <strong>Data Principal</strong>. That holds even though we provide these services through an
          upstream registrar: engaging a supplier to process data on our behalf does not move the
          responsibility for it onto them. If something goes wrong with your data, the obligation to
          answer for it is ours.
        </p>
      </LegalSection>

      <LegalSection title="Our suppliers, and which of them act on our behalf">
        <p>
          The distinction matters, because it decides who you can hold to account:
        </p>
        <ul style={{ margin: '10px 0 0', paddingLeft: '20px' }}>
          <li>
            <strong>Our upstream registrar and hosting suppliers</strong> process data on our
            instructions, as Data Processors. We remain responsible to you for what they do with it.
          </li>
          <li style={{ marginTop: '6px' }}>
            <strong>Domain registries</strong> are different. A registry sets its own rules about
            what a registrant must supply and what it publishes, under its own regulatory framework —
            ICANN for generic extensions, NIXI for .IN. They are not acting on our instructions, and
            we cannot overrule them. Once registrant details are lodged with a registry, we cannot
            withdraw them while the domain exists.
          </li>
          <li style={{ marginTop: '6px' }}>
            <strong>Payment providers</strong> set their own terms for the data they hold about a
            transaction, and are responsible for it directly.
          </li>
        </ul>
        <p style={{ marginTop: '12px' }}>
          Some of these suppliers operate outside India, so providing these services involves
          transferring personal data abroad. We do that only where it is necessary to deliver what
          you asked for, and only to countries not restricted by the Central Government.
        </p>
      </LegalSection>

      <LegalSection title="What we collect, and why">
        <p>Only what a transaction or a service actually requires:</p>
        <ul style={{ margin: '10px 0 0', paddingLeft: '20px' }}>
          <li>
            <strong>Account details</strong> — your name, email address and password. The password is
            stored only as a one-way hash; we cannot read it, and neither can anyone who obtains the
            database.
          </li>
          <li style={{ marginTop: '6px' }}>
            <strong>Billing details</strong> — postal address, phone number, and company name and GSTIN
            where you supply them. A tax invoice is a legal document and must identify the recipient,
            so these appear on the invoices we issue to you.
          </li>
          <li style={{ marginTop: '6px' }}>
            <strong>Registrant details for domains</strong> — name, address, email and phone. Domain
            registries require these from the registrant; a domain cannot be registered without them.
          </li>
          <li style={{ marginTop: '6px' }}>
            <strong>Service records</strong> — which domains and plans you hold, their terms and renewal
            dates, your orders and invoices, and any support tickets you raise.
          </li>
          <li style={{ marginTop: '6px' }}>
            <strong>Technical records</strong> — server logs produced in the ordinary course of serving
            the site, used to keep it working and to investigate abuse.
          </li>
        </ul>
        <p style={{ marginTop: '12px' }}>
          <strong>We do not store your card or bank details.</strong> Payments are taken on the payment
          provider's own systems; we receive confirmation that a payment succeeded and a reference to
          it, and nothing more.
        </p>
      </LegalSection>

      <LegalSection title="Who your data is shared with">
        <p>
          Providing these services is not possible without passing some of this on. We share only what
          the recipient needs:
        </p>
        <ul style={{ margin: '10px 0 0', paddingLeft: '20px' }}>
          <li>
            <strong>Domain registries and our upstream registrar</strong> — registrant details, because
            a registration cannot be completed without them. Registries have their own publication
            rules, and some operate a public WHOIS. Where privacy protection is available for an
            extension and you have it enabled, your details are masked in that public record; it does
            not hide them from the registry itself.
          </li>
          <li style={{ marginTop: '6px' }}>
            <strong>Payment providers</strong> — the amount, currency and an order reference, so the
            payment can be taken and reconciled.
          </li>
          <li style={{ marginTop: '6px' }}>
            <strong>Our email provider</strong> — your address and the message, so we can send order
            confirmations, renewal reminders and replies to tickets.
          </li>
          <li style={{ marginTop: '6px' }}>
            <strong>Tax and regulatory authorities</strong> — where the law requires it.
          </li>
        </ul>
        <p style={{ marginTop: '12px' }}>We do not sell your data, and we do not share it for advertising.</p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          Service records are kept for as long as you hold the service, and afterwards for as long as
          tax and company law require records of a transaction to be retained — which is longer than
          the service itself. Support tickets are kept so that the history of an issue remains
          available to both of us. Closing your account does not delete records we are legally obliged
          to keep.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          We set a session cookie when you sign in; without it the control panel cannot tell who you
          are. Your currency preference is stored in your browser so the site does not forget it
          between visits. Neither is used for advertising or cross-site tracking.
        </p>
      </LegalSection>

      <LegalSection title="What you can ask us to do">
        <p>
          You can ask for a copy of what we hold about you, ask us to correct it, or ask us to delete
          it. Deletion has a limit worth stating plainly: we cannot delete records we are legally
          required to retain, and we cannot withdraw registrant details already lodged with a registry
          while the domain exists. We will tell you specifically what we can and cannot action rather
          than refusing the request as a whole.
        </p>
        <p style={{ marginTop: '10px' }}>
          Write to us at the address above. If you are not satisfied with how we have handled a request,
          you can raise it with the relevant data protection authority.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Access to the administrative console requires an authenticated session, passwords are stored
          only as hashes, and provider credentials are held in the deployment environment rather than
          in the application's source. No system is beyond compromise; if a breach affecting your data
          occurs, we will tell you what happened and what it means for you.
        </p>
      </LegalSection>

      <LegalSection title="Questions, complaints and how to escalate">
        <p>
          You can ask us anything about how your data is handled, and you can complain if you are not
          satisfied with the answer. Write to:
        </p>
        <div style={{ marginTop: '10px', lineHeight: 1.75 }}>
          {identity.grievanceContactName && (
            <div>
              <strong>{identity.grievanceContactName}</strong>
            </div>
          )}
          {identity.grievanceEmail ? (
            <a href={`mailto:${identity.grievanceEmail}`} style={{ color: '#10708A', fontWeight: 700 }}>
              {identity.grievanceEmail}
            </a>
          ) : (
            <MissingFact what="Data-protection contact" />
          )}
        </div>
        <p style={{ marginTop: '12px' }}>
          We will acknowledge your request and tell you what we are doing about it. If you are not
          satisfied with how we have handled it, you may complain to the Data Protection Board of
          India, and to any other authority with jurisdiction over you.
        </p>
      </LegalSection>

      <LegalSection title="If there is a breach">
        <p>
          If a breach affects your personal data, we will tell you and notify the Data Protection
          Board of India, in the manner and within the time the law requires. We will tell you what
          happened, what data was involved, and what it means for you — not simply that an incident
          occurred.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          These services are not offered to children. You must be 18 or over to open an account. We do
          not knowingly collect data from anyone under 18, and we do not profile or direct advertising
          at children. If you believe a child has given us personal data, tell us and we will delete
          it.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          When this policy changes, the date at the top of the page changes with it. Where a change
          materially affects how your data is used, we will tell you by email rather than relying on
          you to notice.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
