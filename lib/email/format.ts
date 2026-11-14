/**
 * Envelope formatting.
 *
 * Kept free of prisma and nodemailer so it can be compiled and tested on its
 * own - the test build compiles single files with no path aliases, and
 * pulling the database client in through an import chain would defeat that.
 */

/** 'Name <addr>' when a name is set, otherwise the bare address. */
export function formatFrom(fromName: string, fromEmail: string): string {
  const email = String(fromEmail || '').trim();
  if (!email) return '';
  const name = String(fromName || '').trim();
  // A display name containing a quote or angle bracket would break the
  // header. Dropping the name still sends; escaping it into something
  // unreadable helps nobody.
  if (!name || /["<>]/.test(name)) return email;
  return `${name} <${email}>`;
}
