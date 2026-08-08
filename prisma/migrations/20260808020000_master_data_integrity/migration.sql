-- Preserve deletion provenance for mutable master data.
ALTER TABLE "users"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by" TEXT,
  ADD COLUMN "delete_reason" TEXT;

ALTER TABLE "warehouses"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by" TEXT,
  ADD COLUMN "delete_reason" TEXT;

ALTER TABLE "stores"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by" TEXT,
  ADD COLUMN "delete_reason" TEXT;

ALTER TABLE "goods_categories"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by" TEXT,
  ADD COLUMN "delete_reason" TEXT;

ALTER TABLE "goods"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by" TEXT,
  ADD COLUMN "delete_reason" TEXT;

ALTER TABLE "containers"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by" TEXT,
  ADD COLUMN "delete_reason" TEXT;

-- Existing archived rows have no trustworthy deletion timestamp. Their last
-- update is the safest available provenance and keeps the new invariant true.
UPDATE "users"
SET "is_active" = false,
    "deleted_at" = COALESCE("deleted_at", "updated_at"),
    "delete_reason" = COALESCE("delete_reason", '历史归档')
WHERE "is_deleted" = true;

UPDATE "warehouses"
SET "is_active" = false,
    "deleted_at" = COALESCE("deleted_at", "updated_at"),
    "delete_reason" = COALESCE("delete_reason", '历史归档')
WHERE "is_deleted" = true;

UPDATE "stores"
SET "is_active" = false,
    "deleted_at" = COALESCE("deleted_at", "updated_at"),
    "delete_reason" = COALESCE("delete_reason", '历史归档')
WHERE "is_deleted" = true;

UPDATE "goods_categories"
SET "is_active" = false,
    "deleted_at" = COALESCE("deleted_at", "updated_at"),
    "delete_reason" = COALESCE("delete_reason", '历史归档')
WHERE "is_deleted" = true;

UPDATE "goods"
SET "is_active" = false,
    "deleted_at" = COALESCE("deleted_at", "updated_at"),
    "delete_reason" = COALESCE("delete_reason", '历史归档')
WHERE "is_deleted" = true;

UPDATE "containers"
SET "is_active" = false,
    "deleted_at" = COALESCE("deleted_at", "updated_at"),
    "delete_reason" = COALESCE("delete_reason", '历史归档')
WHERE "is_deleted" = true;

ALTER TABLE "users"
  ADD CONSTRAINT "users_deleted_lifecycle_check"
  CHECK (NOT "is_deleted" OR ("deleted_at" IS NOT NULL AND NOT "is_active"));

ALTER TABLE "warehouses"
  ADD CONSTRAINT "warehouses_deleted_lifecycle_check"
  CHECK (NOT "is_deleted" OR ("deleted_at" IS NOT NULL AND NOT "is_active"));

ALTER TABLE "stores"
  ADD CONSTRAINT "stores_deleted_lifecycle_check"
  CHECK (NOT "is_deleted" OR ("deleted_at" IS NOT NULL AND NOT "is_active"));

ALTER TABLE "goods_categories"
  ADD CONSTRAINT "goods_categories_deleted_lifecycle_check"
  CHECK (NOT "is_deleted" OR ("deleted_at" IS NOT NULL AND NOT "is_active"));

ALTER TABLE "goods"
  ADD CONSTRAINT "goods_deleted_lifecycle_check"
  CHECK (NOT "is_deleted" OR ("deleted_at" IS NOT NULL AND NOT "is_active"));

ALTER TABLE "containers"
  ADD CONSTRAINT "containers_deleted_lifecycle_check"
  CHECK (NOT "is_deleted" OR ("deleted_at" IS NOT NULL AND NOT "is_active"));

-- Category trees are real relational data, not unvalidated integer pointers.
ALTER TABLE "goods_categories"
  ADD CONSTRAINT "goods_categories_parent_not_self_check"
  CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

ALTER TABLE "goods_categories"
  ADD CONSTRAINT "goods_categories_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "goods_categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "goods_categories_parent_id_idx" ON "goods_categories"("parent_id");
