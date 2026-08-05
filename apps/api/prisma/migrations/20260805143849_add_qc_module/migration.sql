-- CreateTable
CREATE TABLE "qc_controls" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "test_name" TEXT NOT NULL,
    "test_code" TEXT,
    "level" TEXT NOT NULL DEFAULT 'NORMAL',
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "assigned_mean" DECIMAL(12,4) NOT NULL,
    "assigned_sd" DECIMAL(12,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qc_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "measured_value" DECIMAL(12,4) NOT NULL,
    "sd_deviation" DECIMAL(8,2),
    "status" TEXT NOT NULL DEFAULT 'PASS',
    "violations" JSONB,
    "note" TEXT,
    "entered_by_id" UUID,
    "run_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qc_controls_tenant_id_idx" ON "qc_controls"("tenant_id");

-- CreateIndex
CREATE INDEX "qc_controls_tenant_id_test_name_idx" ON "qc_controls"("tenant_id", "test_name");

-- CreateIndex
CREATE INDEX "qc_runs_tenant_id_control_id_created_at_idx" ON "qc_runs"("tenant_id", "control_id", "created_at");

-- AddForeignKey
ALTER TABLE "qc_runs" ADD CONSTRAINT "qc_runs_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "qc_controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
