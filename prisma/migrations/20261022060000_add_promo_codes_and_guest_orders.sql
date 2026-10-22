-- Migration: Add Promo Codes and Guest Order Support
-- Created: 2026-10-22
-- Description: Add PromoCode model, update Order model for guest checkout, idempotency, and voucher reservations

-- Create PromoCodeDiscountType enum
DO $$ BEGIN
    CREATE TYPE "PromoCodeDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create PromoCodeStatus enum
DO $$ BEGIN
    CREATE TYPE "PromoCodeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create PromoCode table
CREATE TABLE IF NOT EXISTS "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "PromoCodeDiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DECIMAL(10,2) NOT NULL,
    "minSpend" DECIMAL(10,2),
    "maxDiscountAmount" DECIMAL(10,2),
    "usageLimit" INTEGER NOT NULL DEFAULT 1,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PromoCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "restrictedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT,
    "restrictedEmails" TEXT[] DEFAULT ARRAY[]::TEXT,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- Create unique index on code
CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_code_key" ON "PromoCode"("code");

-- Create indexes for queries
CREATE INDEX IF NOT EXISTS "PromoCode_status_idx" ON "PromoCode"("status");
CREATE INDEX IF NOT EXISTS "PromoCode_expiresAt_idx" ON "PromoCode"("expiresAt");
CREATE INDEX IF NOT EXISTS "PromoCode_validFrom_idx" ON "PromoCode"("validFrom");
CREATE INDEX IF NOT EXISTS "PromoCode_createdBy_idx" ON "PromoCode"("createdBy");

-- Add promoCodeUsed to Order table
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "promoCodeUsed" TEXT;

-- Add idempotencyKey to Order table with unique constraint
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- Add orderReservations table for expiring voucher reservations
CREATE TABLE IF NOT EXISTS "OrderReservation" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "promoCode" TEXT NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "consumed" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReservation_pkey" PRIMARY KEY ("id")
);

-- Create indexes for reservations
CREATE INDEX IF NOT EXISTS "OrderReservation_promoCodeId_idx" ON "OrderReservation"("promoCodeId");
CREATE INDEX IF NOT EXISTS "OrderReservation_promoCode_idx" ON "OrderReservation"("promoCode");
CREATE INDEX IF NOT EXISTS "OrderReservation_status_idx" ON "OrderReservation"("status");
CREATE INDEX IF NOT EXISTS "OrderReservation_expiresAt_idx" ON "OrderReservation"("expiresAt");
CREATE INDEX IF NOT EXISTS "OrderReservation_orderId_idx" ON "OrderReservation"("orderId");

-- Add comment documenting the migration
COMMENT ON TABLE "PromoCode" IS 'Private promo codes for discounts, managed by admin, validated server-side';
COMMENT ON TABLE "OrderReservation" IS 'Expiring voucher reservations for guest checkout to prevent double-spending of last available use';
