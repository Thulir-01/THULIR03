/*
  Warnings:

  - You are about to alter the column `ref_high` on the `order_tests` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `Decimal(10,2)`.
  - You are about to alter the column `ref_low` on the `order_tests` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,4)` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "order_tests" ADD COLUMN     "sort_order" INTEGER DEFAULT 0,
ALTER COLUMN "ref_high" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "ref_low" SET DATA TYPE DECIMAL(10,2);
