-- AlterTable
ALTER TABLE "doctors_referrers" ADD COLUMN     "discount_percent" DECIMAL(5,2),
ADD COLUMN     "pricing_mode" TEXT DEFAULT 'default';

-- CreateTable
CREATE TABLE "test_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_parameters" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "sampleType" TEXT,
    "unit" TEXT,
    "methodology" TEXT,
    "turnaround_hours" INTEGER,
    "default_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_packages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricing_mode" TEXT NOT NULL DEFAULT 'sum',
    "fixed_price" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_package_items" (
    "id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "parameter_id" UUID NOT NULL,

    CONSTRAINT "test_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrer_prices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "referrer_id" UUID NOT NULL,
    "parameter_id" UUID,
    "package_id" UUID,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrer_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_categories_tenant_id_idx" ON "test_categories"("tenant_id");

-- CreateIndex
CREATE INDEX "test_parameters_tenant_id_idx" ON "test_parameters"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_parameters_tenant_id_code_key" ON "test_parameters"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "test_packages_tenant_id_idx" ON "test_packages"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_packages_tenant_id_code_key" ON "test_packages"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "test_package_items_package_id_parameter_id_key" ON "test_package_items"("package_id", "parameter_id");

-- CreateIndex
CREATE INDEX "referrer_prices_tenant_id_idx" ON "referrer_prices"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrer_prices_referrer_id_parameter_id_key" ON "referrer_prices"("referrer_id", "parameter_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrer_prices_referrer_id_package_id_key" ON "referrer_prices"("referrer_id", "package_id");

-- AddForeignKey
ALTER TABLE "test_parameters" ADD CONSTRAINT "test_parameters_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "test_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_package_items" ADD CONSTRAINT "test_package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "test_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_package_items" ADD CONSTRAINT "test_package_items_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "test_parameters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrer_prices" ADD CONSTRAINT "referrer_prices_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "doctors_referrers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrer_prices" ADD CONSTRAINT "referrer_prices_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "test_parameters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrer_prices" ADD CONSTRAINT "referrer_prices_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "test_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
