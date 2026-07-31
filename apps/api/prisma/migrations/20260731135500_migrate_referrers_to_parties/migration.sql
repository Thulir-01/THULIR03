-- Master Data Management foundation: shared `parties` table + 1:1 doctor
-- extension. Referrers are migrated from `doctors_referrers` REUSING their
-- UUIDs, so existing referrer_prices and orders keep pointing at the same
-- ids — just re-parented onto `parties`.
--
-- Idempotent guards (IF EXISTS / DO blocks): earlier attempts partially
-- committed against the Supabase pooler, so every destructive step is safe
-- to re-run.

-- 1. PartyType enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PartyType') THEN
    CREATE TYPE "PartyType" AS ENUM ('doctor', 'hospital', 'corporate', 'insurance_tpa', 'reference_lab', 'consultant');
  END IF;
END $$;

-- 2. Shared parties table
CREATE TABLE IF NOT EXISTS "parties" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "party_type" "PartyType" NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "gstin" TEXT,
    "primary_contact_name" TEXT,
    "primary_contact_phone" TEXT,
    "primary_contact_email" TEXT,
    "bank_details" JSONB,
    "documents" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- 3. Backfill parties from referrers (same ids, type = doctor).
--    Only insert rows whose ids are not already present (idempotent).
INSERT INTO "parties" ("id", "tenant_id", "party_type", "name", "primary_contact_phone", "primary_contact_email", "status", "created_at", "updated_at", "deleted_at")
SELECT "id", "tenant_id", 'doctor', "name", "phone", "email",
       CASE WHEN "is_active" THEN 'active' ELSE 'inactive' END,
       "created_at", "updated_at", "deleted_at"
FROM "doctors_referrers"
WHERE NOT EXISTS (SELECT 1 FROM "parties" p WHERE p."id" = "doctors_referrers"."id");

-- 4. Doctor extension table
CREATE TABLE IF NOT EXISTS "party_doctor_details" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "medical_council_no" TEXT,
    "specialization" TEXT,
    "qualification" TEXT,
    "commission_percent" DECIMAL(10,2),
    "commission_schedule" TEXT,
    "clinic_affiliation" TEXT,
    "pricing_mode" TEXT DEFAULT 'default',
    "discount_percent" DECIMAL(5,2),
    CONSTRAINT "party_doctor_details_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "party_doctor_details_party_id_key" UNIQUE ("party_id"),
    CONSTRAINT "party_doctor_details_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 5. Backfill doctor details from referrers (map legacy fields; idempotent)
INSERT INTO "party_doctor_details" ("id", "tenant_id", "party_id", "medical_council_no", "specialization", "commission_percent", "clinic_affiliation", "pricing_mode", "discount_percent")
SELECT gen_random_uuid(), "tenant_id", "id", "registration", "specialty", "commission", "clinic_name", "pricing_mode", "discount_percent"
FROM "doctors_referrers"
WHERE NOT EXISTS (SELECT 1 FROM "party_doctor_details" d WHERE d."party_id" = "doctors_referrers"."id");

-- 6. Indexes (match schema; idempotent)
CREATE INDEX IF NOT EXISTS "parties_tenant_id_party_type_idx" ON "parties"("tenant_id", "party_type");
CREATE INDEX IF NOT EXISTS "party_doctor_details_tenant_id_idx" ON "party_doctor_details"("tenant_id");

-- 7. Re-point referrer_prices: referrer_id → party_id (values unchanged)
ALTER TABLE "referrer_prices" DROP CONSTRAINT IF EXISTS "referrer_prices_referrer_id_fkey";
DROP INDEX IF EXISTS "referrer_prices_referrer_id_parameter_id_key";
DROP INDEX IF EXISTS "referrer_prices_referrer_id_package_id_key";
ALTER TABLE "referrer_prices" RENAME COLUMN "referrer_id" TO "party_id";
ALTER TABLE "referrer_prices" ADD CONSTRAINT "referrer_prices_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "referrer_prices_party_id_parameter_id_key" ON "referrer_prices"("party_id", "parameter_id");
CREATE UNIQUE INDEX IF NOT EXISTS "referrer_prices_party_id_package_id_key" ON "referrer_prices"("party_id", "package_id");

-- 8. Re-point orders: doctor_referrer_id → referrer_party_id (values unchanged)
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_doctor_referrer_id_fkey";
ALTER TABLE "orders" RENAME COLUMN "doctor_referrer_id" TO "referrer_party_id";
ALTER TABLE "orders" ADD CONSTRAINT "orders_referrer_party_id_fkey" FOREIGN KEY ("referrer_party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 9. Drop the legacy referrer table
DROP TABLE IF EXISTS "doctors_referrers";
