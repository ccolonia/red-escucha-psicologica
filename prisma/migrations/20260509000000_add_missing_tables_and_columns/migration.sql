-- Migration: Add missing tables and columns to sync DB with Prisma schema
-- This migration adds: PasswordToken table, Professional extended fields, ContactRequest.status & updatedAt

-- Add missing columns to Professional table
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "profession" TEXT;
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "cuil" TEXT;
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "therapyTypes" TEXT;
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "targetAudience" TEXT;
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "therapyModality" TEXT;
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "onlineAttention" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "presentialAttention" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "homeAttention" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "zones" TEXT;

-- Add missing columns to ContactRequest table
ALTER TABLE "ContactRequest" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'nuevo';
ALTER TABLE "ContactRequest" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create PasswordToken table (if not exists)
CREATE TABLE IF NOT EXISTS "PasswordToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordToken_pkey" PRIMARY KEY ("id")
);

-- Create unique index on token if not exists
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordToken_token_key" ON "PasswordToken"("token");

-- Add foreign key if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'PasswordToken_userId_fkey'
  ) THEN
    ALTER TABLE "PasswordToken" ADD CONSTRAINT "PasswordToken_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
