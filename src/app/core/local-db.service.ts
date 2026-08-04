/**
 * local-db.service.ts — IndexedDB schema via Dexie 4.
 *
 * Tables:
 *  inventory   — full InventoryItemRow keyed by id
 *  shop        — single shop profile row (key = shopId)
 *  syncMeta    — per-table sync timestamps  (key = tableName)
 *
 * Rules:
 *  - Never store auth tokens here; those live in httpOnly cookies.
 *  - All reads are synchronous-feeling (IndexedDB microtask, < 1 ms on warm cache).
 *  - All writes are fire-and-forget from the perspective of the UI.
 */
import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';
import type { InventoryItemRow } from './database.types';
import type { ShopProfile } from './shop.store';

export interface SyncMeta {
  tableName: string;   // PK
  lastSyncAt: string;  // ISO-8601 timestamp of last successful sync
}

class ShopPulseDB extends Dexie {
  inventory!: Table<InventoryItemRow, string>;
  shop!:      Table<ShopProfile,      string>;
  syncMeta!:  Table<SyncMeta,         string>;

  constructor() {
    super('ShopPulseDB');
    this.version(1).stores({
      // Only indexed fields listed — all object fields are stored regardless
      inventory: 'id, shop_id, category, classification, updated_at',
      shop:      'id',
      syncMeta:  'tableName',
    });
  }
}

@Injectable({ providedIn: 'root' })
export class LocalDbService {
  private readonly db = new ShopPulseDB();

  // ── Inventory ─────────────────────────────────────────────────────────────

  async getAllInventory(): Promise<InventoryItemRow[]> {
    return this.db.inventory.toArray();
  }

  async bulkUpsertInventory(items: InventoryItemRow[]): Promise<void> {
    await this.db.inventory.bulkPut(items);
  }

  async upsertInventoryItem(item: InventoryItemRow): Promise<void> {
    await this.db.inventory.put(item);
  }

  async removeInventoryItem(id: string): Promise<void> {
    await this.db.inventory.delete(id);
  }

  async clearInventory(): Promise<void> {
    await this.db.inventory.clear();
  }

  // ── Shop profile ──────────────────────────────────────────────────────────

  async getShop(shopId: string): Promise<ShopProfile | undefined> {
    return this.db.shop.get(shopId);
  }

  async putShop(shop: ShopProfile): Promise<void> {
    await this.db.shop.put(shop);
  }

  async clearShop(): Promise<void> {
    await this.db.shop.clear();
  }

  // ── Sync meta ─────────────────────────────────────────────────────────────

  async getLastSyncAt(tableName: string): Promise<string | null> {
    const meta = await this.db.syncMeta.get(tableName);
    return meta?.lastSyncAt ?? null;
  }

  async setLastSyncAt(tableName: string, iso: string): Promise<void> {
    await this.db.syncMeta.put({ tableName, lastSyncAt: iso });
  }

  async clearAllMeta(): Promise<void> {
    await this.db.syncMeta.clear();
  }

  // ── Full wipe (on sign-out) ───────────────────────────────────────────────

  async clearAll(): Promise<void> {
    await Promise.all([
      this.db.inventory.clear(),
      this.db.shop.clear(),
      this.db.syncMeta.clear(),
    ]);
  }
}
