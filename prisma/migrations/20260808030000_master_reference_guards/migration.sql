-- Serialize logical master-data deletion with the creation or reactivation of
-- business references. Foreign keys protect physical identity; these triggers
-- protect the is_deleted lifecycle without storing legacy identifiers.

CREATE OR REPLACE FUNCTION replenops_require_active_master(
  master_table regclass,
  master_id integer,
  master_entity text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  archived boolean;
BEGIN
  EXECUTE format('SELECT is_deleted FROM %s WHERE id = $1 FOR SHARE', master_table)
    INTO archived
    USING master_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF archived THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format('REPLENOPS_ACTIVE_MASTER_REQUIRED:%s', master_entity);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_goods_master()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT NEW.is_deleted THEN
    PERFORM replenops_require_active_master('goods_categories', NEW.category_id, 'category');
    IF NEW.container_id IS NOT NULL THEN
      PERFORM replenops_require_active_master('containers', NEW.container_id, 'container');
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT OLD.is_deleted AND NEW.is_deleted THEN
    IF EXISTS (
      SELECT 1
      FROM inventories
      WHERE goods_id = NEW.id
        AND NOT is_deleted
        AND (quantity <> 0 OR locked_quantity <> 0 OR available_quantity <> 0)
    ) OR EXISTS (
      SELECT 1
      FROM order_items item
      JOIN orders parent ON parent.id = item.order_id
      WHERE item.goods_id = NEW.id
        AND NOT item.is_deleted
        AND NOT parent.is_deleted
        AND parent.status IN ('PENDING', 'APPROVED', 'PROCESSING')
    ) OR EXISTS (
      SELECT 1
      FROM stock_in_items item
      JOIN stock_ins parent ON parent.id = item.stock_in_id
      WHERE item.goods_id = NEW.id
        AND NOT item.is_deleted
        AND NOT parent.is_deleted
        AND parent.status IN ('PENDING', 'APPROVED', 'PROCESSING')
    ) OR EXISTS (
      SELECT 1
      FROM stock_out_items item
      JOIN stock_outs parent ON parent.id = item.stock_out_id
      WHERE item.goods_id = NEW.id
        AND NOT item.is_deleted
        AND NOT parent.is_deleted
        AND parent.status IN ('PENDING', 'APPROVED', 'PROCESSING')
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'REPLENOPS_MASTER_HAS_ACTIVE_REFERENCES:goods';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_category_master()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT NEW.is_deleted AND NEW.parent_id IS NOT NULL THEN
    PERFORM replenops_require_active_master('goods_categories', NEW.parent_id, 'category');
  END IF;

  IF TG_OP = 'UPDATE' AND NOT OLD.is_deleted AND NEW.is_deleted AND (
    EXISTS (SELECT 1 FROM goods WHERE category_id = NEW.id AND NOT is_deleted)
    OR EXISTS (SELECT 1 FROM goods_categories WHERE parent_id = NEW.id AND NOT is_deleted)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'REPLENOPS_MASTER_HAS_ACTIVE_REFERENCES:category';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_store_master()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT OLD.is_deleted AND NEW.is_deleted THEN
    UPDATE container_tracking
    SET is_deleted = true
    WHERE store_id = NEW.id
      AND NOT is_deleted
      AND current_borrowed = 0;

    IF EXISTS (
      SELECT 1 FROM orders
      WHERE store_id = NEW.id
        AND NOT is_deleted
        AND status IN ('PENDING', 'APPROVED', 'PROCESSING')
    ) OR EXISTS (
      SELECT 1 FROM container_tracking
      WHERE store_id = NEW.id AND NOT is_deleted
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'REPLENOPS_MASTER_HAS_ACTIVE_REFERENCES:store';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_warehouse_master()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT OLD.is_deleted AND NEW.is_deleted AND (
    EXISTS (
      SELECT 1 FROM inventories
      WHERE warehouse_id = NEW.id
        AND NOT is_deleted
        AND (quantity <> 0 OR locked_quantity <> 0 OR available_quantity <> 0)
    )
    OR EXISTS (
      SELECT 1 FROM stock_ins
      WHERE warehouse_id = NEW.id
        AND NOT is_deleted
        AND status IN ('PENDING', 'APPROVED', 'PROCESSING')
    )
    OR EXISTS (
      SELECT 1 FROM stock_outs
      WHERE warehouse_id = NEW.id
        AND NOT is_deleted
        AND status IN ('PENDING', 'APPROVED', 'PROCESSING')
    )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'REPLENOPS_MASTER_HAS_ACTIVE_REFERENCES:warehouse';
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
    WHERE container_id = NEW.id
      AND NOT is_deleted
      AND current_borrowed = 0;

    IF EXISTS (SELECT 1 FROM goods WHERE container_id = NEW.id AND NOT is_deleted)
      OR EXISTS (SELECT 1 FROM container_tracking WHERE container_id = NEW.id AND NOT is_deleted)
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'REPLENOPS_MASTER_HAS_ACTIVE_REFERENCES:container';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_order_master_references()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  referenced_goods record;
BEGIN
  IF NOT NEW.is_deleted AND NEW.status IN ('PENDING', 'APPROVED', 'PROCESSING') THEN
    PERFORM replenops_require_active_master('stores', NEW.store_id, 'store');
    FOR referenced_goods IN
      SELECT goods.id, goods.is_deleted
      FROM goods
      JOIN order_items item ON item.goods_id = goods.id
      WHERE item.order_id = NEW.id AND NOT item.is_deleted
      ORDER BY goods.id
      FOR SHARE OF goods
    LOOP
      IF referenced_goods.is_deleted THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'REPLENOPS_ACTIVE_MASTER_REQUIRED:goods';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_stock_in_master_references()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  referenced_goods record;
BEGIN
  IF NOT NEW.is_deleted AND NEW.status IN ('PENDING', 'APPROVED', 'PROCESSING') THEN
    PERFORM replenops_require_active_master('warehouses', NEW.warehouse_id, 'warehouse');
    FOR referenced_goods IN
      SELECT goods.id, goods.is_deleted
      FROM goods
      JOIN stock_in_items item ON item.goods_id = goods.id
      WHERE item.stock_in_id = NEW.id AND NOT item.is_deleted
      ORDER BY goods.id
      FOR SHARE OF goods
    LOOP
      IF referenced_goods.is_deleted THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'REPLENOPS_ACTIVE_MASTER_REQUIRED:goods';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_stock_out_master_references()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  referenced_goods record;
BEGIN
  IF NOT NEW.is_deleted AND NEW.status IN ('PENDING', 'APPROVED', 'PROCESSING') THEN
    PERFORM replenops_require_active_master('warehouses', NEW.warehouse_id, 'warehouse');
    FOR referenced_goods IN
      SELECT goods.id, goods.is_deleted
      FROM goods
      JOIN stock_out_items item ON item.goods_id = goods.id
      WHERE item.stock_out_id = NEW.id AND NOT item.is_deleted
      ORDER BY goods.id
      FOR SHARE OF goods
    LOOP
      IF referenced_goods.is_deleted THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'REPLENOPS_ACTIVE_MASTER_REQUIRED:goods';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_order_item_goods()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT NEW.is_deleted AND EXISTS (
    SELECT 1 FROM orders
    WHERE id = NEW.order_id
      AND NOT is_deleted
      AND status IN ('PENDING', 'APPROVED', 'PROCESSING')
  ) THEN
    PERFORM replenops_require_active_master('goods', NEW.goods_id, 'goods');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_stock_in_item_goods()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT NEW.is_deleted AND EXISTS (
    SELECT 1 FROM stock_ins
    WHERE id = NEW.stock_in_id
      AND NOT is_deleted
      AND status IN ('PENDING', 'APPROVED', 'PROCESSING')
  ) THEN
    PERFORM replenops_require_active_master('goods', NEW.goods_id, 'goods');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_stock_out_item_goods()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT NEW.is_deleted AND EXISTS (
    SELECT 1 FROM stock_outs
    WHERE id = NEW.stock_out_id
      AND NOT is_deleted
      AND status IN ('PENDING', 'APPROVED', 'PROCESSING')
  ) THEN
    PERFORM replenops_require_active_master('goods', NEW.goods_id, 'goods');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_inventory_masters()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT NEW.is_deleted
    AND (NEW.quantity <> 0 OR NEW.locked_quantity <> 0 OR NEW.available_quantity <> 0)
  THEN
    PERFORM replenops_require_active_master('warehouses', NEW.warehouse_id, 'warehouse');
    PERFORM replenops_require_active_master('goods', NEW.goods_id, 'goods');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_container_tracking_masters()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT NEW.is_deleted THEN
    PERFORM replenops_require_active_master('stores', NEW.store_id, 'store');
    PERFORM replenops_require_active_master('containers', NEW.container_id, 'container');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER goods_master_reference_guard
  BEFORE INSERT OR UPDATE ON goods
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_goods_master();

CREATE TRIGGER category_master_reference_guard
  BEFORE INSERT OR UPDATE ON goods_categories
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_category_master();

CREATE TRIGGER store_master_reference_guard
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_store_master();

CREATE TRIGGER warehouse_master_reference_guard
  BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_warehouse_master();

CREATE TRIGGER container_master_reference_guard
  BEFORE UPDATE ON containers
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_container_master();

CREATE TRIGGER order_master_reference_guard
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_order_master_references();

CREATE TRIGGER stock_in_master_reference_guard
  BEFORE INSERT OR UPDATE ON stock_ins
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_stock_in_master_references();

CREATE TRIGGER stock_out_master_reference_guard
  BEFORE INSERT OR UPDATE ON stock_outs
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_stock_out_master_references();

CREATE TRIGGER order_item_goods_guard
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_order_item_goods();

CREATE TRIGGER stock_in_item_goods_guard
  BEFORE INSERT OR UPDATE ON stock_in_items
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_stock_in_item_goods();

CREATE TRIGGER stock_out_item_goods_guard
  BEFORE INSERT OR UPDATE ON stock_out_items
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_stock_out_item_goods();

CREATE TRIGGER inventory_master_reference_guard
  BEFORE INSERT OR UPDATE ON inventories
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_inventory_masters();

CREATE TRIGGER container_tracking_master_reference_guard
  BEFORE INSERT OR UPDATE ON container_tracking
  FOR EACH ROW EXECUTE FUNCTION replenops_guard_container_tracking_masters();
