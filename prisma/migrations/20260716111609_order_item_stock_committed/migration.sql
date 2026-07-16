-- Tracks per-line whether THIS order item's stock decrement actually
-- succeeded at settlement, so cancel/return can restock exactly what was
-- taken instead of inferring it from the order's status (which was wrong for
-- ON_HOLD orders — see the schema comment on OrderItem.stockCommitted).
ALTER TABLE "OrderItem" ADD COLUMN "stockCommitted" BOOLEAN NOT NULL DEFAULT false;
