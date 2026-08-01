-- CreateTable
CREATE TABLE "staff_details" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "registration_no" TEXT,
    "qualification" TEXT,
    "designation" TEXT,
    "signature_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_details_user_id_key" ON "staff_details"("user_id");

-- CreateIndex
CREATE INDEX "staff_details_tenant_id_idx" ON "staff_details"("tenant_id");

-- AddForeignKey
ALTER TABLE "staff_details" ADD CONSTRAINT "staff_details_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
