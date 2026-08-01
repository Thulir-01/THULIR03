-- CreateEnum
CREATE TYPE "LookupMasterType" AS ENUM ('sample_type', 'container_type', 'unit', 'method', 'payment_mode', 'rejection_reason', 'discount_scheme', 'tax_rate');

-- CreateTable
CREATE TABLE "lookup_masters" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "LookupMasterType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metadata" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lookup_masters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lookup_masters_tenant_id_type_code_key" ON "lookup_masters"("tenant_id", "type", "code");

-- CreateIndex
CREATE INDEX "lookup_masters_tenant_id_type_idx" ON "lookup_masters"("tenant_id", "type");
