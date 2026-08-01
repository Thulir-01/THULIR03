-- AlterTable: TestCategory gains auto-code prefix + category-level defaults
ALTER TABLE "test_categories" ADD COLUMN IF NOT EXISTS "code_prefix" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "default_sample_type" TEXT,
ADD COLUMN IF NOT EXISTS "default_turnaround_hours" INTEGER;

-- AlterTable: TestParameter gains numeric reference range (snapshotted to OrderTest)
ALTER TABLE "test_parameters" ADD COLUMN IF NOT EXISTS "ref_low" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "ref_high" DECIMAL(10,2);

-- CreateTable: MastersSequence — persistent per-tenant, per-scope counters
CREATE TABLE IF NOT EXISTS "masters_sequences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "masters_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one counter row per (tenant, scope)
CREATE UNIQUE INDEX IF NOT EXISTS "masters_sequences_tenant_id_scope_key" ON "masters_sequences"("tenant_id", "scope");
