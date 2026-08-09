-- Serialize document activation with item writes before validating goods lifecycle state.
CREATE OR REPLACE FUNCTION replenops_guard_order_item_goods()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_is_active boolean := false;
BEGIN
  IF NOT NEW.is_deleted THEN
    BEGIN
      SELECT NOT is_deleted AND status IN ('PENDING', 'APPROVED', 'PROCESSING')
      INTO parent_is_active
      FROM orders
      WHERE id = NEW.order_id
      FOR SHARE NOWAIT;
    EXCEPTION
      WHEN lock_not_available THEN
        RAISE EXCEPTION USING
          ERRCODE = '40001',
          MESSAGE = 'REPLENOPS_DOCUMENT_STATE_CONCURRENTLY_CHANGED:order';
    END;

    IF parent_is_active THEN
      PERFORM replenops_require_active_master('goods', NEW.goods_id, 'goods');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_stock_in_item_goods()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_is_active boolean := false;
BEGIN
  IF NOT NEW.is_deleted THEN
    BEGIN
      SELECT NOT is_deleted AND status IN ('PENDING', 'APPROVED', 'PROCESSING')
      INTO parent_is_active
      FROM stock_ins
      WHERE id = NEW.stock_in_id
      FOR SHARE NOWAIT;
    EXCEPTION
      WHEN lock_not_available THEN
        RAISE EXCEPTION USING
          ERRCODE = '40001',
          MESSAGE = 'REPLENOPS_DOCUMENT_STATE_CONCURRENTLY_CHANGED:stockIn';
    END;

    IF parent_is_active THEN
      PERFORM replenops_require_active_master('goods', NEW.goods_id, 'goods');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION replenops_guard_stock_out_item_goods()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_is_active boolean := false;
BEGIN
  IF NOT NEW.is_deleted THEN
    BEGIN
      SELECT NOT is_deleted AND status IN ('PENDING', 'APPROVED', 'PROCESSING')
      INTO parent_is_active
      FROM stock_outs
      WHERE id = NEW.stock_out_id
      FOR SHARE NOWAIT;
    EXCEPTION
      WHEN lock_not_available THEN
        RAISE EXCEPTION USING
          ERRCODE = '40001',
          MESSAGE = 'REPLENOPS_DOCUMENT_STATE_CONCURRENTLY_CHANGED:stockOut';
    END;

    IF parent_is_active THEN
      PERFORM replenops_require_active_master('goods', NEW.goods_id, 'goods');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
