-- AlterTable
ALTER TABLE "parties" ADD COLUMN     "commercial" JSONB;

-- AlterTable
ALTER TABLE "test_parameters" ADD COLUMN     "auto_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "calculation_formula" TEXT,
ADD COLUMN     "critical_value_alert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "detection_limit" DECIMAL(12,4),
ADD COLUMN     "limit_type" TEXT,
ADD COLUMN     "lower_limit" DECIMAL(12,4),
ADD COLUMN     "reporting_limit" DECIMAL(12,4),
ADD COLUMN     "requires_approval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "test_category" TEXT,
ADD COLUMN     "upper_limit" DECIMAL(12,4),
ADD COLUMN     "visible_on_report" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "hospital_masters" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "place" TEXT,
    "street" TEXT,
    "pin_code" TEXT,
    "zone" TEXT,
    "mobile" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "fax" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "website" TEXT,
    "pan_no" TEXT,
    "header_image_path" TEXT,
    "footer_image_path" TEXT,
    "report_name" TEXT,
    "header_margin_px" INTEGER,
    "footer_margin_px" INTEGER,
    "inactive" BOOLEAN NOT NULL DEFAULT false,
    "upload_results" BOOLEAN NOT NULL DEFAULT false,
    "no_sms" BOOLEAN NOT NULL DEFAULT false,
    "no_email" BOOLEAN NOT NULL DEFAULT false,
    "outsource_tests" BOOLEAN NOT NULL DEFAULT false,
    "footer_info" BOOLEAN NOT NULL DEFAULT false,
    "month_wise_commission" BOOLEAN NOT NULL DEFAULT false,
    "critical_email" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_report" BOOLEAN NOT NULL DEFAULT false,
    "enable_online_booking" BOOLEAN NOT NULL DEFAULT false,
    "block_print_when_due" BOOLEAN NOT NULL DEFAULT false,
    "auto_invoice" BOOLEAN NOT NULL DEFAULT false,
    "auto_invoice_period" TEXT,
    "preferred_doctor_id" UUID,
    "collection_boy_id" UUID,
    "report_display_mode" TEXT,
    "credit_bill" BOOLEAN NOT NULL DEFAULT false,
    "cash_bill" BOOLEAN NOT NULL DEFAULT false,
    "credit_days" INTEGER,
    "credit_limit" DECIMAL(12,2),
    "web_password" TEXT,
    "sent_channels" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_type_masters" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "collection_method" TEXT,
    "container_type" TEXT,
    "container_color" TEXT,
    "storage_condition" TEXT,
    "shelf_life_hours" INTEGER,
    "pre_analytical" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requires_requisition" BOOLEAN NOT NULL DEFAULT false,
    "auto_generate_id" BOOLEAN NOT NULL DEFAULT false,
    "reject_on_hemolysis" BOOLEAN NOT NULL DEFAULT false,
    "composite_sample" BOOLEAN NOT NULL DEFAULT false,
    "priority_default" TEXT,
    "tat_hours" INTEGER,
    "associated_tests" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sample_type_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_methods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standard_body" TEXT,
    "category" TEXT,
    "reference_doc" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "version_control" BOOLEAN NOT NULL DEFAULT false,
    "default_parameters" JSONB,
    "safety_precautions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model_name" TEXT,
    "manufacturer" TEXT,
    "asset_tag" TEXT,
    "serial_no" TEXT,
    "location" TEXT NOT NULL DEFAULT 'Lab A',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assigned_to" TEXT,
    "calibration_frequency" TEXT,
    "last_calibrated_at" TIMESTAMP(3),
    "next_calibration_due" TIMESTAMP(3),
    "calibration_standard" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requires_qc" BOOLEAN NOT NULL DEFAULT false,
    "downtime_warning" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hospital_masters_tenant_id_is_active_idx" ON "hospital_masters"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_masters_tenant_id_code_key" ON "hospital_masters"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "sample_type_masters_tenant_id_active_idx" ON "sample_type_masters"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "sample_type_masters_tenant_id_code_key" ON "sample_type_masters"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "test_methods_tenant_id_active_idx" ON "test_methods"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "test_methods_tenant_id_code_key" ON "test_methods"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "instruments_tenant_id_active_idx" ON "instruments"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "instruments_tenant_id_code_key" ON "instruments"("tenant_id", "code");
