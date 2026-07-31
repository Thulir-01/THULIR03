-- AlterTable
ALTER TABLE "order_tests" ADD COLUMN     "signature_hash" TEXT,
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by" UUID;
