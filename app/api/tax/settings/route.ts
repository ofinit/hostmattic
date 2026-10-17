import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Statutory identity is NEVER defaulted.
//
// These previously carried a GSTIN (32AABCO1234F1Z5), a PAN, a Kochi address
// and "Kerala" as the seller's state, none of which belong to the registered
// company. They were served whenever the database was unreachable, and the
// admin route seeded them into a fresh database, so an invoice could carry a
// tax number belonging to nobody under a name that is not the legal entity.
//
// Only the genuinely general values are defaulted: the GST rate and the SAC
// code. Everything that identifies the seller is blank until configured, and
// the invoice renders a blank one as visibly unset rather than plausible.
const DEFAULT_TAX_SETTINGS = {
  id: 'default_tax_settings',
  gstRate: 18.0,
  legalBusinessName: '',
  sellerGstin: '',
  registeredAddress: '',
  city: '',
  state: '',
  stateCode: '',
  panNumber: '',
  defaultSacCode: '998315',
  lutNumber: '',
  usdGstPolicy: 'LUT_EXPORT', // 'LUT_EXPORT' (0% with LUT) or 'APPLY_GST'
};

export async function GET(req: NextRequest) {
  try {
    let settings = null;
    try {
      settings = await prisma.taxSetting.findUnique({
        where: { id: 'default_tax_settings' },
      });
      if (!settings) {
        settings = await prisma.taxSetting.create({
          data: DEFAULT_TAX_SETTINGS,
        });
      }
    } catch (dbErr) {
      console.warn('[Tax API] DB read failed, using defaults');
      settings = DEFAULT_TAX_SETTINGS;
    }

    return NextResponse.json({
      success: true,
      settings: settings || DEFAULT_TAX_SETTINGS,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      settings: DEFAULT_TAX_SETTINGS,
    });
  }
}
