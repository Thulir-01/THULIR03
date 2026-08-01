-- AlterTable: technician verify → pathologist approve workflow columns
ALTER TABLE "orders" ADD COLUMN "verified_by" UUID,
ADD COLUMN "verified_at" TIMESTAMP(3),
ADD COLUMN "approved_by" UUID,
ADD COLUMN "approved_at" TIMESTAMP(3);
