import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_TAX_SETTINGS = {
  id: 'default_tax_settings',
  gstRate: 18.0,
  legalBusinessName: 'Hostmattic Technologies / OfinIT Solutions',
  sellerGstin: '32AABCO1234F1Z5',
  registeredAddress: 'Building 4B, Infopark Technology Hub',
  city: 'Kochi',
  state: 'Kerala',
  stateCode: '32',
  panNumber: 'AABCO1234F',
  defaultSacCode: '998315',
  lutNumber: 'LUT/AD320324001928K',
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
