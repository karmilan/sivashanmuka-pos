-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('PIECE', 'KILOGRAM', 'GRAM', 'LITRE', 'MILLILITRE', 'PACKET', 'BOX');

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "category_id" TEXT,
    "base_unit" "ProductUnit" NOT NULL,
    "is_weighted" BOOLEAN NOT NULL,
    "quantity_precision" INTEGER NOT NULL,
    "default_cost" DECIMAL(12,2),
    "default_selling_price" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL,
    "tracks_expiry" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_barcodes" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_barcodes_barcode_key" ON "product_barcodes"("barcode");

-- CreateIndex
CREATE INDEX "product_barcodes_product_id_idx" ON "product_barcodes"("product_id");

-- AddCheckConstraint
ALTER TABLE "products" ADD CONSTRAINT "products_quantity_precision_check" CHECK ("quantity_precision" BETWEEN 0 AND 3);

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;