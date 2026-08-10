/**
 * API model types for the ShopPulse Node.js backend.
 *
 * These interfaces match the JSON shapes returned by the Express API routes
 * at /api/v1/... — they are NOT generated from the Supabase DB schema.
 *
 * The frontend has zero visibility into Postgres types; it only sees what
 * the backend chooses to serialize in its response bodies.
 */

// ── Enums (string unions matching Postgres enum values) ──────────────────────

export type ItemClassification = 'NEW' | 'USED';
export type OrderChannel       = 'POS' | 'ONLINE';
export type PaymentMethod      = 'CASH' | 'CARD_KHATA' | 'DIGITAL_PAY';

// ── Inventory ────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/v1/inventory and inventory write endpoints. */
export interface InventoryItemRow {
  id:             string;
  shop_id:        string;
  classification: ItemClassification;
  name:           string;
  description:    string | null;
  category:       string;
  imei:           string | null;
  imei2:          string | null;
  sku:            string | null;
  stock:          number;
  cost_price:     number;
  selling_price:  number;
  version:        number;
  created_at:     string;
  updated_at:     string;
}

export interface CreateInventoryItemBody {
  classification: ItemClassification;
  name:           string;
  description?:   string | null;
  category:       string;
  imei?:          string | null;
  imei2?:         string | null;
  sku?:           string | null;
  stock:          number;
  cost_price:     number;
  selling_price:  number;
}

export interface UpdateInventoryItemBody {
  name?:          string;
  description?:   string | null;
  category?:      string;
  stock?:         number;
  sku?:           string | null;
  cost_price?:    number;
  selling_price?: number;
  /** Must match the current row version; 409 returned on mismatch. */
  version:        number;
}

// ── Orders ───────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/v1/orders list endpoint. */
export interface OrderRow {
  id:               string;
  shop_id:          string;
  order_number:     string;
  customer_name:    string | null;
  customer_phone:   string | null;
  customer_cnic:    string | null;
  channel:          OrderChannel;
  payment_method:   PaymentMethod;
  subtotal:         number;
  discount:         number;
  total:            number;
  payment_verified: boolean;
  idempotency_key:  string | null;
  created_at:       string;
}

/** Shape returned by GET /api/v1/orders/:id (includes line items). */
export interface OrderWithItems extends OrderRow {
  order_items: OrderItemRow[];
}

export interface OrderItemRow {
  id:                string;
  order_id:          string;
  inventory_item_id: string | null;
  name_snapshot:     string;
  description:       string | null;
  qty:               number;
  unit_price:        number;
  line_total:        number;
}

// ── POS checkout ─────────────────────────────────────────────────────────────

export interface CheckoutItem {
  inventoryId:  string;
  qty:          number;
  unitPrice:    number;
  nameSnapshot: string;
  customPrice?: number | null;
}

export interface CheckoutBody {
  items:          CheckoutItem[];
  discount:       number;
  paymentMethod:  PaymentMethod;
  idempotencyKey: string;
}

export interface CheckoutResponse {
  order: OrderRow;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface RevenueSeries {
  day:           string; // ISO date string "YYYY-MM-DD"
  total_revenue: number;
  order_count:   number;
}

export interface DashboardStatsResponse {
  newOrders:           number;
  revenueToday:        number;
  totalInventoryItems: number;
  lowStockCount:       number;
  revenueSeries:       RevenueSeries[];
}

// ── Settings / Shop ──────────────────────────────────────────────────────────

/** Shape returned by GET /api/v1/settings. */
export interface ShopSettingsResponse {
  id:                  string;
  shopName:            string;
  phone:               string | null;
  address:             string | null;
  /** Base64 data URI — null when no QR has been uploaded. */
  paymentQrDataUri:    string | null;
  autoExportFrequency: string;
  autoPrintReceipt:    boolean;
}

export interface UpdateSettingsBody {
  shopName?:            string;
  phone?:               string | null;
  address?:             string | null;
  autoExportFrequency?: string;
  autoPrintReceipt?:    boolean;
}

// ── Devices ──────────────────────────────────────────────────────────────────

export interface DeviceRow {
  deviceId:     string;
  deviceName:   string;
  lastActiveAt: string;
  createdAt:    string;
  /** True when this response is for the device making the request. */
  current:      boolean;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface SessionResponse {
  authenticated: boolean;
  user: {
    id:    string;
    email: string;
  } | null;
  shop: {
    id:   string;
    name: string;
  } | null;
}
