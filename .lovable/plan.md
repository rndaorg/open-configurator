## Advanced Inventory Management

Enhance the existing inventory system with batch tracking, supplier management, automated reorder points, sales-trend forecasting, multi-warehouse support, and a new admin Inventory Reports section.

### 1. Database (migration)

New tables (all admin-managed via RLS using `has_role(auth.uid(), 'admin')`; public read where noted):

- **`warehouses`** — name, code, address (jsonb), is_active, is_default. Admin manage; authenticated read.
- **`suppliers`** — name, contact_name, email, phone, address (jsonb), lead_time_days, notes, is_active. Admin only.
- **`supplier_products`** — supplier_id, option_value_id, supplier_sku, cost_price, min_order_quantity, lead_time_days. Admin only.
- **`inventory_batches`** — option_value_id, warehouse_id, supplier_id, batch_number, quantity, received_at, expires_at, cost_price, status (active/depleted/expired). Admin only.
- **`warehouse_inventory`** — option_value_id, warehouse_id, available_quantity, reserved_quantity, reorder_point, reorder_quantity, low_stock_threshold (replaces single-warehouse model; `inventory_levels` kept for backward compat and treated as aggregate view).
- **`reorder_alerts`** — option_value_id, warehouse_id, supplier_id, suggested_quantity, status (pending/ordered/dismissed), triggered_at. Admin only.
- **`inventory_movements`** — option_value_id, warehouse_id, batch_id, movement_type (receipt/sale/transfer/adjustment/reservation/release), quantity, reference_id, notes, created_by, created_at. Admin read; system insert.

Triggers:
- On `warehouse_inventory` UPDATE: when `available_quantity <= reorder_point`, insert into `reorder_alerts` (idempotent on pending) and a `notifications` row for admins.
- Aggregate trigger: keep `inventory_levels.available_quantity` in sync as SUM across warehouses for backward compatibility with existing UI.

### 2. Edge Functions

- **`inventory-forecast`** — admin-only. Input: `option_value_id`, optional `warehouse_id`, `horizon_days` (Zod). Pulls last 90 days of sales from `order_items` + `orders`, computes 7/30-day moving average and simple linear trend, returns projected daily demand, days-of-stock-remaining, and recommended reorder date/qty.
- **`inventory-reorder-suggestions`** — admin-only. Scans all SKUs, returns prioritized reorder list (incorporates supplier lead time + forecast).
- Extend **`external-inventory`** to accept optional `warehouse_id` for sync/reserve/release.

All inputs validated with Zod; all responses include CORS headers.

### 3. Admin UI

New routes under `/admin`:
- **`/admin/warehouses`** — CRUD warehouses, mark default.
- **`/admin/suppliers`** — CRUD suppliers + linked SKUs (cost, lead time).
- **`/admin/inventory`** — multi-warehouse stock grid per SKU with batch breakdown drawer, reorder-point editing, manual adjustments, transfer-between-warehouses dialog.
- **`/admin/inventory/reports`** — tabbed dashboard:
  - Stock-on-hand by warehouse (table + bar chart)
  - Low stock & reorder alerts (actionable list → "Create PO" stub)
  - Forecast view (per-SKU line chart of historical sales vs projected demand)
  - Batch expiry timeline
  - Supplier performance (lead time accuracy, fill rate)
  - CSV export per report

Add nav links in `AdminLayout.tsx`. Reuse existing chart primitives (`recharts` via `components/ui/chart`).

### 4. Frontend integration

- Update `InventoryStatus` and `useInventoryCheck` to read aggregated `warehouse_inventory` (sum across warehouses) so customer-facing UI is unchanged.
- No customer-facing UI changes beyond the existing in-stock badges.

### 5. i18n

Add new keys under `inventory.*`, `suppliers.*`, `warehouses.*`, `inventory.reports.*` in all five locale files.

### Technical notes

- All business logic (forecast math, reorder evaluation) runs server-side per project rule.
- Edge function secrets: none new required; uses existing `SUPABASE_SERVICE_ROLE_KEY`.
- Backward compatibility: `inventory_levels` retained and auto-synced via trigger, so existing reservations (`external-inventory`) keep working until migrated.
- Memory updates: add `mem://features/advanced-inventory` describing the multi-warehouse model and forecasting approach.

Approve to proceed with the migration first, then code.
