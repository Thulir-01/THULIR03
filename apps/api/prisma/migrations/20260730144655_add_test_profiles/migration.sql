-- AlterTable
ALTER TABLE "order_tests" ADD COLUMN     "is_profile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_test_id" UUID,
ADD COLUMN     "ref_high" DECIMAL(12,4),
ADD COLUMN     "ref_low" DECIMAL(12,4);

-- AddForeignKey
ALTER TABLE "order_tests" ADD CONSTRAINT "order_tests_parent_test_id_fkey" FOREIGN KEY ("parent_test_id") REFERENCES "order_tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
