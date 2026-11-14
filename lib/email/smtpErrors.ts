/**
 * Turning nodemailer's errors into something an administrator can act on.
 *
 * Its messages are accurate but terse: "Invalid login" and "connect
 * ECONNREFUSED" do not say which of the four fields on the settings form is
 * wrong. Kept apart from the transport so it carries no dependency on
 * nodemailer itself and can be tested directly.
 */

export function describeSmtpError(err: any): string {
  const code = String(err?.code || '');
  const responseCode = Number(err?.responseCode || 0);
  const raw = String(err?.message || 'SMTP error');

  if (code === 'EAUTH' || responseCode === 535 || responseCode === 534) {
    return `The mail server rejected the username or password. (${raw})`;
  }
  if (code === 'ECONNREFUSED') {
    return `Nothing is listening on that host and port. Check the host and port. (${raw})`;
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
    return (
      'Could not reach the mail server - it may be blocked by a firewall, or the port may be ' +
      `wrong. Port 465 needs TLS on; 587 needs it off. (${raw})`
    );
  }
  if (code === 'EENVELOPE' || responseCode === 550 || responseCode === 553) {
    return `The server refused the sender or recipient address. (${raw})`;
  }
  if (/self.signed|unable to verify|certificate/i.test(raw)) {
    return (
      'The server presented a certificate that could not be verified. Fix the certificate, or ' +
      `tick "allow invalid certificate" if this is a server you control. (${raw})`
    );
  }
  return raw;
}
