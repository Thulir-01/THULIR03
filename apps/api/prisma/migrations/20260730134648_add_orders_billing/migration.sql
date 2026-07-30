-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "amount_paid" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "balance_amount" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "bed_no" TEXT,
ADD COLUMN     "bill_amount" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "bill_hf" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "clinical_remarks" TEXT,
ADD COLUMN     "collection_boy" TEXT,
ADD COLUMN     "consolidated_bill" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "delivery_mode" TEXT,
ADD COLUMN     "discount_amount" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "discount_auth" TEXT,
ADD COLUMN     "discount_percent" DECIMAL(5,2) DEFAULT 0,
ADD COLUMN     "emergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "final_report_date" TIMESTAMP(3),
ADD COLUMN     "insurance_details" TEXT,
ADD COLUMN     "ip_op_no" TEXT,
ADD COLUMN     "other_charges" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "patient_type" TEXT,
ADD COLUMN     "payment_date" TIMESTAMP(3),
ADD COLUMN     "payment_mode" TEXT,
ADD COLUMN     "payment_ref" TEXT,
ADD COLUMN     "payment_remarks" TEXT,
ADD COLUMN     "ref_no" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "sample_collect_date" TIMESTAMP(3),
ADD COLUMN     "sid_date" TIMESTAMP(3),
ADD COLUMN     "source" TEXT,
ADD COLUMN     "total_amount" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "ward" TEXT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "age_months" INTEGER,
ADD COLUMN     "age_years" INTEGER,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "order_tests" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "test_code" TEXT NOT NULL,
    "test_name" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "unit" TEXT,
    "ref_range" TEXT,

    CONSTRAINT "order_tests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_tests_order_id_test_code_key" ON "order_tests"("order_id", "test_code");

-- AddForeignKey
ALTER TABLE "order_tests" ADD CONSTRAINT "order_tests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
