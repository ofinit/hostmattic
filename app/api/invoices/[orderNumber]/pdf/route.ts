import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { renderInvoicePdf, invoiceFilename, InvoiceSeller } from '@/lib/invoice/pdf';

export const dynamic = 'force-dynamic';

/**
 * GET /api/invoices/<orderNumber>/pdf
 *
 * Downloads a tax invoice.
 *
 * Accepts either the invoice number or the order number, because the customer
 * sees one and the admin console lists the other, and both are unique.
 *
 * Order references are sequential and therefore guessable, so a customer is
 * scoped to their own orders by userId. Only an administrator may fetch
 * someone else's. Getting this wrong would hand anyone another customer's
 * name, address and GSTIN by incrementing a number.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { orderNumber: string } }
) {
  const session = requireAuth(req);
  if (session instanceof NextResponse) return session;

  const reference = decodeURIComponent(params.orderNumber || '').trim();
  if (!reference) {
    return NextResponse.json({ success: false, error: 'No invoice was specified.' }, { status: 400 });
  }

  const isAdmin = session.role === 'ADMIN';

  const order = await prisma.order.findFirst({
    where: {
      OR: [{ orderNumber: reference }, { invoiceNumber: reference }],
      // An administrator may fetch any invoice; everyone else only their own.
      ...(isAdmin ? {} : { userId: session.id }),
    },
    include: {
      items: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (!order) {
    // Deliberately the same answer whether the order belongs to someone else
    // or does not exist, so this cannot be used to enumerate orders.
    return NextResponse.json({ success: false, error: 'Invoice not found.' }, { status: 404 });
  }

  const settings = await prisma.taxSetting.findUnique({ where: { id: 'default_tax_settings' } });

  // Statutory identity is whatever has been configured. Nothing is invented
  // here: an unconfigured field prints as "Not configured" on the document,
  // which is a visible prompt to fix it rather than a plausible-looking lie.
  const seller: InvoiceSeller = {
    legalBusinessName: settings?.legalBusinessName || '',
    sellerGstin: settings?.sellerGstin || '',
    registeredAddress: settings?.registeredAddress || '',
    city: settings?.city || '',
    state: settings?.state || '',
    stateCode: settings?.stateCode || '',
    panNumber: settings?.panNumber || '',
    defaultSacCode: settings?.defaultSacCode || '998315',
    lutNumber: settings?.lutNumber || '',
  };

  try {
    const bytes = await renderInvoicePdf(order as any, seller);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoiceFilename(order)}"`,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error(`[invoice pdf] ${reference}:`, err?.message);
    return NextResponse.json(
      { success: false, error: 'The invoice could not be generated.' },
      { status: 500 }
    );
  }
}
