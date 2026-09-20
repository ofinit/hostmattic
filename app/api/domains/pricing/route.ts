import { NextRequest, NextResponse } from 'next/server';
import { getLiveDomainPricing } from '@/lib/api/pricing';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const pricing = await getLiveDomainPricing();
    const promos = Object.values(pricing).filter((p) => p.isPromo);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      pricing,
      promos,
      totalPromos: promos.length,
    });
  } catch (error: any) {
    console.error('Error fetching domain pricing:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch live pricing' },
      { status: 500 }
    );
  }
}
