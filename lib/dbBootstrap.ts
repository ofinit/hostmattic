import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

let isBootstrapping = false;
let isBootstrapped = false;

export async function ensureDatabaseBootstrap() {
  if (isBootstrapped) return;
  if (isBootstrapping) return;

  isBootstrapping = true;
  try {
    // 1. Create tables if they do not exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT PRIMARY KEY,
        "email" TEXT UNIQUE NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "company" TEXT,
        "phone" TEXT,
        "address" TEXT,
        "city" TEXT,
        "state" TEXT,
        "country" TEXT,
        "zip" TEXT,
        "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
        "upstreamCustomerId" TEXT,
        "lockedCurrency" TEXT,
        "currencyLockedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "Domain" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "domainName" TEXT UNIQUE NOT NULL,
        "tld" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiryDate" TIMESTAMP(3) NOT NULL,
        "autoRenew" BOOLEAN NOT NULL DEFAULT true,
        "privacyEnabled" BOOLEAN NOT NULL DEFAULT true,
        "nameservers" TEXT DEFAULT 'ns1.hostmattic.com,ns2.hostmattic.com',
        "upstreamOrderId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "HostingAccount" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "productType" TEXT NOT NULL,
        "planName" TEXT NOT NULL,
        "domainName" TEXT NOT NULL,
        "serverIp" TEXT DEFAULT '198.51.100.24',
        "cpanelUsername" TEXT,
        "serverLocation" TEXT NOT NULL DEFAULT 'US',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "billingCycle" TEXT NOT NULL DEFAULT 'ANNUAL',
        "nextDueDate" TIMESTAMP(3) NOT NULL,
        "upstreamOrderId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "TaxSetting" (
        "id" TEXT PRIMARY KEY DEFAULT 'default_tax_settings',
        "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 18.0,
        "legalBusinessName" TEXT NOT NULL DEFAULT 'Hostmattic Technologies / OfinIT Solutions',
        "sellerGstin" TEXT NOT NULL DEFAULT '',
        "registeredAddress" TEXT NOT NULL DEFAULT '',
        "city" TEXT NOT NULL DEFAULT '',
        "state" TEXT NOT NULL DEFAULT 'Kerala',
        "stateCode" TEXT NOT NULL DEFAULT '32',
        "panNumber" TEXT NOT NULL DEFAULT '',
        "defaultSacCode" TEXT NOT NULL DEFAULT '998315',
        "lutNumber" TEXT NOT NULL DEFAULT 'LUT/2026-27/001',
        "usdGstPolicy" TEXT NOT NULL DEFAULT 'LUT_EXPORT',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "Order" (
        "id" TEXT PRIMARY KEY,
        "orderNumber" TEXT UNIQUE NOT NULL,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "subtotalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "totalAmount" DOUBLE PRECISION NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'USD',
        "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
        "paymentMethod" TEXT NOT NULL DEFAULT 'CREDIT_CARD',
        "status" TEXT NOT NULL DEFAULT 'COMPLETED',
        "customerType" TEXT NOT NULL DEFAULT 'B2C',
        "customerGstin" TEXT,
        "companyName" TEXT,
        "billingAddress" TEXT,
        "billingCity" TEXT,
        "billingState" TEXT DEFAULT 'Kerala',
        "billingCountry" TEXT DEFAULT 'IN',
        "placeOfSupply" TEXT DEFAULT '32-Kerala',
        "taxType" TEXT DEFAULT 'CGST_SGST',
        "cgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "sgstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        "gatewayName" TEXT,
        "gatewayOrderId" TEXT,
        "gatewayPaymentId" TEXT,
        "gatewaySignature" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "OrderItem" (
        "id" TEXT PRIMARY KEY,
        "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
        "productType" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "sacCode" TEXT DEFAULT '998315',
        "price" DOUBLE PRECISION NOT NULL,
        "billingPeriod" TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "SupportTicket" (
        "id" TEXT PRIMARY KEY,
        "ticketNumber" TEXT UNIQUE NOT NULL,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "subject" TEXT NOT NULL,
        "department" TEXT NOT NULL,
        "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
        "status" TEXT NOT NULL DEFAULT 'OPEN',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "TicketMessage" (
        "id" TEXT PRIMARY KEY,
        "ticketId" TEXT NOT NULL REFERENCES "SupportTicket"("id") ON DELETE CASCADE,
        "sender" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "isAdmin" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
      CREATE INDEX IF NOT EXISTS "Domain_userId_idx" ON "Domain"("userId");
      CREATE INDEX IF NOT EXISTS "HostingAccount_userId_idx" ON "HostingAccount"("userId");
      CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");
      CREATE INDEX IF NOT EXISTS "SupportTicket_userId_idx" ON "SupportTicket"("userId");
    `);

    // 2. Ensure initial administrator exists
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@hostmattic.com').toLowerCase().trim();
    const adminPass = process.env.ADMIN_PASSWORD || 'Hostmattic@2026';

    const existingAdmin = await prisma.user.findFirst({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPass, 12);
      await prisma.user.create({
        data: {
          id: 'admin_root_seed',
          email: adminEmail,
          passwordHash,
          name: 'Hostmattic Administrator',
          role: 'ADMIN',
        },
      });
      console.log(`[Hostmattic DB Bootstrap] Seeded administrator: ${adminEmail}`);
    } else if (existingAdmin.role !== 'ADMIN') {
      await prisma.user.update({
        where: { email: adminEmail },
        data: { role: 'ADMIN' },
      });
    }

    // 3. Ensure TaxSetting default row exists
    const taxCount = await prisma.taxSetting.count();
    if (taxCount === 0) {
      await prisma.taxSetting.create({
        data: {
          id: 'default_tax_settings',
          gstRate: 18.0,
          legalBusinessName: 'Hostmattic Technologies / OfinIT Solutions',
          state: 'Kerala',
          stateCode: '32',
          lutNumber: 'LUT/2026-27/001',
          usdGstPolicy: 'LUT_EXPORT',
        },
      });
    }

    isBootstrapped = true;
    console.log('[Hostmattic DB Bootstrap] Database schema & baseline state verified.');
  } catch (err: any) {
    console.error('[Hostmattic DB Bootstrap] Bootstrap warning:', err?.message || err);
  } finally {
    isBootstrapping = false;
  }
}
