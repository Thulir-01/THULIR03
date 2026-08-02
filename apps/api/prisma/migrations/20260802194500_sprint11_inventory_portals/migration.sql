-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "parties" ADD COLUMN     "user_id" UUID;

-- CreateTable
CREATE TABLE "inventory_suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "inventory_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT,
    "min_stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "quantity_on_hand" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "supplier_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "batch_no" TEXT,
    "expiry_date" TIMESTAMP(3),
    "unit_cost" DECIMAL(10,2),
    "reference" TEXT,
    "notes" TEXT,
    "performed_by" UUID,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_inventory_requirements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parameter_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,

    CONSTRAINT "test_inventory_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_suppliers_tenant_id_idx" ON "inventory_suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "inventory_items_tenant_id_idx" ON "inventory_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_tenant_id_sku_key" ON "inventory_items"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "inventory_transactions_tenant_id_item_id_idx" ON "inventory_transactions"("tenant_id", "item_id");

-- CreateIndex
CREATE INDEX "test_inventory_requirements_tenant_id_idx" ON "test_inventory_requirements"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_inventory_requirements_parameter_id_item_id_key" ON "test_inventory_requirements"("parameter_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "parties_user_id_key" ON "parties"("user_id");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "inventory_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_inventory_requirements" ADD CONSTRAINT "test_inventory_requirements_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "test_parameters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_inventory_requirements" ADD CONSTRAINT "test_inventory_requirements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
