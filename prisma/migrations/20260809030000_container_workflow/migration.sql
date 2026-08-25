CREATE TYPE "container_return_status" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED');

CREATE TABLE "container_goods_bindings" (
    "id" SERIAL NOT NULL,
    "container_id" INTEGER NOT NULL,
    "goods_id" INTEGER NOT NULL,
    "goods_quantity_per_container" DECIMAL(10,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "container_goods_bindings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "container_goods_bindings_quantity_check" CHECK ("goods_quantity_per_container" > 0)
);

CREATE UNIQUE INDEX "container_goods_bindings_container_id_goods_id_key"
  ON "container_goods_bindings"("container_id", "goods_id");
CREATE INDEX "container_goods_bindings_goods_id_idx"
  ON "container_goods_bindings"("goods_id");

INSERT INTO "container_goods_bindings" (
  "container_id",
  "goods_id",
  "goods_quantity_per_container",
  "created_at",
  "updated_at"
)
SELECT
  "container_id",
  "id",
  "container_ratio",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "goods"
WHERE "container_id" IS NOT NULL AND "container_ratio" > 0;

CREATE TABLE "stock_out_container_items" (
    "id" SERIAL NOT NULL,
    "stock_out_id" INTEGER NOT NULL,
    "container_id" INTEGER NOT NULL,
    "container_code_snapshot" TEXT NOT NULL,
    "container_name_snapshot" TEXT NOT NULL,
    "container_unit_snapshot" TEXT NOT NULL,
    "expected_quantity" INTEGER NOT NULL,
    "shipped_quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_out_container_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_out_container_items_quantity_check"
      CHECK ("expected_quantity" >= 0 AND "shipped_quantity" >= 0)
);

CREATE UNIQUE INDEX "stock_out_container_items_stock_out_id_container_id_key"
  ON "stock_out_container_items"("stock_out_id", "container_id");

ALTER TABLE "container_tracking"
  ADD COLUMN "pending_return_quantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "container_tracking" ALTER COLUMN "total_borrowed" DROP DEFAULT;
ALTER TABLE "container_tracking" ALTER COLUMN "total_returned" DROP DEFAULT;
ALTER TABLE "container_tracking" ALTER COLUMN "current_borrowed" DROP DEFAULT;
ALTER TABLE "container_tracking"
  ALTER COLUMN "total_borrowed" TYPE INTEGER USING ROUND("total_borrowed")::INTEGER,
  ALTER COLUMN "total_returned" TYPE INTEGER USING ROUND("total_returned")::INTEGER,
  ALTER COLUMN "current_borrowed" TYPE INTEGER USING ROUND("current_borrowed")::INTEGER;
ALTER TABLE "container_tracking" ALTER COLUMN "total_borrowed" SET DEFAULT 0;
ALTER TABLE "container_tracking" ALTER COLUMN "total_returned" SET DEFAULT 0;
ALTER TABLE "container_tracking" ALTER COLUMN "current_borrowed" SET DEFAULT 0;
ALTER TABLE "container_tracking" ADD CONSTRAINT "container_tracking_balance_check"
  CHECK (
    "total_borrowed" >= 0
    AND "total_returned" >= 0
    AND "current_borrowed" >= 0
    AND "pending_return_quantity" >= 0
    AND "pending_return_quantity" <= "current_borrowed"
  );

CREATE TABLE "container_returns" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "store_id" INTEGER NOT NULL,
    "status" "container_return_status" NOT NULL DEFAULT 'PENDING',
    "remark" TEXT,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "container_returns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "container_returns_code_key" ON "container_returns"("code");
CREATE INDEX "container_returns_status_submitted_at_idx"
  ON "container_returns"("status", "submitted_at");

CREATE TABLE "container_return_items" (
    "id" SERIAL NOT NULL,
    "container_return_id" INTEGER NOT NULL,
    "container_tracking_id" INTEGER NOT NULL,
    "container_id" INTEGER NOT NULL,
    "requested_quantity" INTEGER NOT NULL,
    "received_quantity" INTEGER,
    CONSTRAINT "container_return_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "container_return_items_quantity_check"
      CHECK ("requested_quantity" > 0 AND ("received_quantity" IS NULL OR "received_quantity" BETWEEN 0 AND "requested_quantity"))
);

CREATE UNIQUE INDEX "container_return_items_container_return_id_container_id_key"
  ON "container_return_items"("container_return_id", "container_id");

UPDATE "container_logs" log
SET "container_id" = tracking."container_id"
FROM "container_tracking" tracking
WHERE log."container_tracking_id" = tracking."id"
  AND log."container_id" IS NULL;

ALTER TABLE "container_logs" ADD COLUMN "container_return_id" INTEGER;
ALTER TABLE "container_logs" DROP CONSTRAINT "container_logs_container_id_fkey";
ALTER TABLE "container_logs" ALTER COLUMN "container_id" SET NOT NULL;
ALTER TABLE "container_logs"
  ALTER COLUMN "quantity" TYPE INTEGER USING ROUND("quantity")::INTEGER,
  ALTER COLUMN "before_borrowed" TYPE INTEGER USING ROUND("before_borrowed")::INTEGER,
  ALTER COLUMN "after_borrowed" TYPE INTEGER USING ROUND("after_borrowed")::INTEGER;

ALTER TABLE "goods" DROP COLUMN "container_id", DROP COLUMN "container_ratio";

ALTER TABLE "container_goods_bindings"
  ADD CONSTRAINT "container_goods_bindings_container_id_fkey"
  FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "container_goods_bindings_goods_id_fkey"
  FOREIGN KEY ("goods_id") REFERENCES "goods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_out_container_items"
  ADD CONSTRAINT "stock_out_container_items_stock_out_id_fkey"
  FOREIGN KEY ("stock_out_id") REFERENCES "stock_outs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_out_container_items_container_id_fkey"
  FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "container_returns"
  ADD CONSTRAINT "container_returns_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "container_return_items"
  ADD CONSTRAINT "container_return_items_container_return_id_fkey"
  FOREIGN KEY ("container_return_id") REFERENCES "container_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "container_return_items_container_tracking_id_fkey"
  FOREIGN KEY ("container_tracking_id") REFERENCES "container_tracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "container_return_items_container_id_fkey"
  FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "container_logs"
  ADD CONSTRAINT "container_logs_container_id_fkey"
  FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "container_logs_container_return_id_fkey"
  FOREIGN KEY ("container_return_id") REFERENCES "container_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION replenops_guard_goods_master()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT NEW.is_deleted THEN
    PERFORM replenops_require_active_master('goods_categories', NEW.category_id, 'category');
  END IF;

  IF TG_OP = 'UPDATE' AND NOT OLD.is_deleted AND NEW.is_deleted THEN
    IF EXISTS (
      SELECT 1 FROM inventories
      WHERE goods_id = NEW.id AND NOT is_deleted
        AND (quantity <> 0 OR locked_quantity <> 0 OR available_quantity <> 0)
    ) OR EXISTS (
      SELECT 1 FROM order_items item JOIN orders parent ON parent.id = item.order_id
      WHERE item.goods_id = NEW.id AND NOT item.is_deleted AND NOT parent.is_deleted
        AND parent.status IN ('PENDING', 'APPROVED', 'PROCESSING')
    ) OR EXISTS (
      SELECT 1 FROM stock_in_items item JOIN stock_ins parent ON parent.id = item.stock_in_id
      WHERE item.goods_id = NEW.id AND NOT item.is_deleted AND NOT parent.is_deleted
        AND parent.status IN ('PENDING', 'APPROVED', 'PROCESSING')
    ) OR EXISTS (
      SELECT 1 FROM stock_out_items item JOIN stock_outs parent ON parent.id = item.stock_out_id
      WHERE item.goods_id = NEW.id AND NOT item.is_deleted AND NOT parent.is_deleted
        AND parent.status IN ('PENDING', 'APPROVED', 'PROCESSING')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'REPLENOPS_MASTER_HAS_ACTIVE_REFERENCES:goods';
    END IF;

    DELETE FROM container_goods_bindings WHERE goods_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_container_master()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT OLD.is_deleted AND NEW.is_deleted THEN
    UPDATE container_tracking
    SET is_deleted = true
    WHERE container_id = NEW.id AND NOT is_deleted
      AND current_borrowed = 0 AND pending_return_quantity = 0;

    IF EXISTS (
      SELECT 1 FROM container_goods_bindings binding
      JOIN goods ON goods.id = binding.goods_id
      WHERE binding.container_id = NEW.id AND NOT goods.is_deleted
    ) OR EXISTS (
      SELECT 1 FROM container_tracking
      WHERE container_id = NEW.id AND NOT is_deleted
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'REPLENOPS_MASTER_HAS_ACTIVE_REFERENCES:container';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_container_goods_binding()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM replenops_require_active_master('containers', NEW.container_id, 'container');
  PERFORM replenops_require_active_master('goods', NEW.goods_id, 'goods');
  RETURN NEW;
END;
$$;

CREATE TRIGGER container_goods_binding_master_guard
  BEFORE INSERT OR UPDATE ON container_goods_bindings
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_container_goods_binding();
