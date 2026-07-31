-- CreateTable
CREATE TABLE "samples" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "sample_no" TEXT NOT NULL,
    "sample_collect_date" TIMESTAMP(3),
    "collected_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejected_reason" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "samples_pkey" PRIMARY KEY ("id")
);

-- Backfill: one default sample per existing order (sampleCollectDt copied,
-- status follows the order — 'completed' if the order is done, else 'pending').
INSERT INTO "samples" ("id", "tenant_id", "order_id", "sample_no", "sample_collect_date", "status", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    o."tenant_id",
    o."id",
    'SPL-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)),
    o."sample_collect_date",
    CASE WHEN o."status" = 'completed' THEN 'completed' ELSE 'pending' END,
    NOW(),
    NOW()
FROM "orders" o;

-- AlterTable — add columns as nullable, backfill, then enforce NOT NULL
-- (existing order_tests rows have no value yet).
ALTER TABLE "order_tests" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "order_tests" ADD COLUMN "sample_id" UUID;

-- Backfill tenant_id from the parent order.
UPDATE "order_tests" ot
SET "tenant_id" = o."tenant_id"
FROM "orders" o
WHERE o."id" = ot."order_id" AND ot."tenant_id" IS NULL;

-- Repoint every test to the order's (newly created) sample.
UPDATE "order_tests" ot
SET "sample_id" = s."id"
FROM "samples" s
WHERE s."order_id" = ot."order_id" AND ot."sample_id" IS NULL;

ALTER TABLE "order_tests" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "order_tests" ALTER COLUMN "sample_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "samples_sample_no_key" ON "samples"("sample_no");

-- CreateIndex
CREATE INDEX "samples_tenant_id_idx" ON "samples"("tenant_id");

-- CreateIndex
CREATE INDEX "samples_order_id_idx" ON "samples"("order_id");

-- CreateIndex
CREATE INDEX "order_tests_tenant_id_idx" ON "order_tests"("tenant_id");

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_tests" ADD CONSTRAINT "order_tests_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
