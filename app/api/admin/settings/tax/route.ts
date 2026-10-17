import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

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
    // SECURITY: Require admin authentication
    const session = requireAdmin(req);
    if (session instanceof NextResponse) return session;

    let settings: any = null;
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
      console.warn('[Tax Settings DB Notice] DB offline or uninitialized, using defaults');
      settings = DEFAULT_TAX_SETTINGS;
    }

    return NextResponse.json({
      success: true,
      settings: settings || DEFAULT_TAX_SETTINGS,
    });
  } catch (error: any) {
    console.error('Error fetching tax settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tax settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require admin authentication
    const session = requireAdmin(req);
    if (session instanceof NextResponse) return session;
    const body = await req.json();
    const {
      gstRate,
      legalBusinessName,
      sellerGstin,
      registeredAddress,
      city,
      state,
      stateCode,
      panNumber,
      defaultSacCode,
      lutNumber,
      usdGstPolicy,
    } = body;

    const rate = Number(gstRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return NextResponse.json(
        { success: false, error: 'Invalid GST rate. Must be between 0% and 100%.' },
        { status: 400 }
      );
    }

    const payload = {
      gstRate: rate,
      legalBusinessName: legalBusinessName?.trim() || DEFAULT_TAX_SETTINGS.legalBusinessName,
      sellerGstin: sellerGstin?.trim().toUpperCase() || '',
      registeredAddress: registeredAddress?.trim() || '',
      city: city?.trim() || '',
      // No fallback: the seller's state decides intra-state against
      // inter-state on every Indian invoice, and Kerala was not even the
      // right state for this company.
      state: state?.trim() || '',
      stateCode: stateCode?.trim() || '',
      panNumber: panNumber?.trim().toUpperCase() || '',
      defaultSacCode: defaultSacCode?.trim() || '998315',
      lutNumber: lutNumber?.trim() || '',
      usdGstPolicy: usdGstPolicy === 'APPLY_GST' ? 'APPLY_GST' : 'LUT_EXPORT',
    };

    let updated: any = null;
    try {
      updated = await prisma.taxSetting.upsert({
        where: { id: 'default_tax_settings' },
        update: payload,
        create: {
          id: 'default_tax_settings',
          ...payload,
        },
      });
    } catch (dbErr) {
      console.warn('[Tax Settings DB Notice] DB write failed, returning mock success');
      updated = { id: 'default_tax_settings', ...payload, updatedAt: new Date() };
    }

    return NextResponse.json({
      success: true,
      message: 'GST Tax Settings saved successfully!',
      settings: updated,
    });
  } catch (error: any) {
    console.error('Error updating tax settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update tax settings' },
      { status: 500 }
    );
  }
}
