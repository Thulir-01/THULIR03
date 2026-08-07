-- AlterTable
ALTER TABLE "qc_controls" ADD COLUMN     "instrument_id" UUID;

-- CreateTable
CREATE TABLE "lab_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lab_configs_tenant_id_key_key" ON "lab_configs"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "qc_controls_tenant_id_instrument_id_idx" ON "qc_controls"("tenant_id", "instrument_id");

-- AddForeignKey
ALTER TABLE "qc_controls" ADD CONSTRAINT "qc_controls_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
