-- CreateIndex
CREATE INDEX "doctors_referrers_tenant_id_idx" ON "doctors_referrers"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_tenant_id_idx" ON "orders"("tenant_id");

-- CreateIndex
CREATE INDEX "patients_tenant_id_idx" ON "patients"("tenant_id");
