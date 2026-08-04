/**
 * local-db.service.ts — IndexedDB schema via Dexie 4.
 *
 * Tables:
 *  inventory      — full InventoryItemRow keyed by id
 *  orders         — full OrderRow keyed by id, indexed on created_at
 *  shop           — single shop profile row (key = shopId)
 *  dashboardStats — KPI snapshot + revenue series, keyed by "shopId:days"
 *  syncMeta       — per-table sync timestamps (key = tableName)
 *
 * Version history:
 *  v1 — inventory, shop, syncMeta
 *  v2 — added orders
 *  v3 — added dashboardStats
 */
import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';
import type { InventoryItemRow, OrderRow } from './database.types';
import type { ShopProfile } from './shop.store';

// ── Stored types ──────────────────────────────────────────────────────────────

export interface SyncMeta {
  tableName:  string;  // PK
  lastSyncAt: string;  // ISO-8601 timestamp of last successful sync
}

export interface CachedDashboardStats {
  /** Composite key: "<shopId>:<days>"  e.g. "abc123:30" */
  key:                 string;
  shopId:              string;
  days:                number;
  newOrders:           number;
  revenueToday:        number;
  totalInventoryItems: number;
  lowStockCount:       number;
  revenueSeries: Array<{ day: string; total_revenue: number; order_count: number }>;
  cachedAt:            string;  // ISO-8601 — used to decide whether to show stale data
}

// ── Dexie DB class ────────────────────────────────────────────────────────────

class ShopPulseDB extends Dexie {
  inventory!:      Table<InventoryItemRow,      string>;
  orders!:         Table<OrderRow,              string>;
  shop!:           Table<ShopProfile,           string>;
  dashboardStats!: Table<CachedDashboardStats,  string>;
  syncMeta!:       Table<SyncMeta,              string>;

  constructor() {
    super('ShopPulseDB');

    this.version(1).stores({
      inventory: 'id, shop_id, category, classification, updated_at',
      shop:      'id',
      syncMeta:  'tableName',
    });

    this.version(2).stores({
      inventory: 'id, shop_id, category, classification, updated_at',
      orders:    'id, shop_id, created_at, payment_method, channel',
      shop:      'id',
      syncMeta:  'tableName',
    });

    this.version(3).stores({
      inventory:      'id, shop_id, category, classification, updated_at',
      orders:         'id, shop_id, created_at, payment_method, channel',
      shop:           'id',
      dashboardStats: 'key, shopId',   // composite key lookup + shopId index for wipe
      syncMeta:       'tableName',
    });
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LocalDbService {
  private readonly db = new ShopPulseDB();

  // ── Inventory ──────────────────────────────────────────────────────────────

  getAllInventory(): Promise<InventoryItemRow[]> {
    return this.db.inventory.toArray();
  }

  bulkUpsertInventory(items: InventoryItemRow[]): Promise<void> {
    return this.db.inventory.bulkPut(items).then(() => void 0);
  }

  upsertInventoryItem(item: InventoryItemRow): Promise<void> {
    return this.db.inventory.put(item).then(() => void 0);
  }

  removeInventoryItem(id: string): Promise<void> {
    return this.db.inventory.delete(id);
  }

  clearInventory(): Promise<void> {
    return this.db.inventory.clear();
  }

  // ── Orders ─────────────────────────────────────────────────────────────────

  getAllOrders(): Promise<OrderRow[]> {
    return this.db.orders.orderBy('created_at').reverse().toArray();
  }

  bulkUpsertOrders(orders: OrderRow[]): Promise<void> {
    return this.db.orders.bulkPut(orders).then(() => void 0);
  }

  prependOrder(order: OrderRow): Promise<void> {
    return this.db.orders.put(order).then(() => void 0);
  }

  clearOrders(): Promise<void> {
    return this.db.orders.clear();
  }

  // ── Shop profile (settings) ────────────────────────────────────────────────

  getShop(shopId: string): Promise<ShopProfile | undefined> {
    return this.db.shop.get(shopId);
  }

  putShop(shop: ShopProfile): Promise<void> {
    return this.db.shop.put(shop).then(() => void 0);
  }

  clearShop(): Promise<void> {
    return this.db.shop.clear();
  }

  // ── Dashboard stats ────────────────────────────────────────────────────────

  /** Key format: "<shopId>:<days>" */
  private static statsKey(shopId: string, days: number): string {
    return `${shopId}:${days}`;
  }

  getDashboardStats(shopId: string, days: number): Promise<CachedDashboardStats | undefined> {
    return this.db.dashboardStats.get(LocalDbService.statsKey(shopId, days));
  }

  putDashboardStats(stats: Omit<CachedDashboardStats, 'key'>): Promise<void> {
    const record: CachedDashboardStats = {
      ...stats,
      key: LocalDbService.statsKey(stats.shopId, stats.days),
    };
    return this.db.dashboardStats.put(record).then(() => void 0);
  }

  clearDashboardStats(): Promise<void> {
    return this.db.dashboardStats.clear();
  }

  // ── Sync meta ──────────────────────────────────────────────────────────────

  async getLastSyncAt(tableName: string): Promise<string | null> {
    const meta = await this.db.syncMeta.get(tableName);
    return meta?.lastSyncAt ?? null;
  }

  setLastSyncAt(tableName: string, iso: string): Promise<void> {
    return this.db.syncMeta.put({ tableName, lastSyncAt: iso }).then(() => void 0);
  }

  clearAllMeta(): Promise<void> {
    return this.db.syncMeta.clear();
  }

  // ── Full wipe (on sign-out) ────────────────────────────────────────────────

  clearAll(): Promise<void> {
    return Promise.all([
      this.db.inventory.clear(),
      this.db.orders.clear(),
      this.db.shop.clear(),
      this.db.dashboardStats.clear(),
      this.db.syncMeta.clear(),
    ]).then(() => void 0);
  }
}
