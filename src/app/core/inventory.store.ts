/**
 * inventory.store.ts — offline-first signal store.
 *
 * Boot sequence:
 *  1. Read IndexedDB synchronously → _items signal populated immediately
 *     (0 ms perceived latency if user has visited before).
 *  2. Determine last sync timestamp from IndexedDB meta.
 *  3. Fetch only rows with updated_at > lastSyncAt from the API (delta sync).
 *  4. Merge deltas into IndexedDB and update _items signal.
 *
 * On first-ever load (empty IDB), step 3 fetches the full catalog.
 * On subsequent loads, only changed/new rows are transferred.
 *
 * Realtime (Supabase postgres_changes) still patches _items and IDB live
 * for INSERT/UPDATE/DELETE events while the app is open.
 */
import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiClient } from './api.client';
import { LocalDbService } from './local-db.service';
import type { InventoryItemRow } from './database.types';

const SYNC_KEY = 'inventory';

@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private readonly api     = inject(ApiClient);
  private readonly localDb = inject(LocalDbService);

  private readonly _items   = signal<InventoryItemRow[]>([]);
  private readonly _loading = signal(false);  // true only during network sync
  private readonly _error   = signal<string | null>(null);

  readonly items        = this._items.asReadonly();
  readonly loading      = this._loading.asReadonly();
  readonly error        = this._error.asReadonly();
  readonly totalCount    = computed(() => this._items().length);
  readonly inStockCount  = computed(() => this._items().filter(i => i.stock > 0).length);
  readonly outOfStockCount = computed(() => this._items().filter(i => i.stock === 0).length);
  readonly lowStockCount = computed(() =>
    this._items().filter(i => i.stock > 0 && i.stock <= 5).length,
  );
  readonly totalStockValue = computed(() =>
    this._items().reduce((s, i) => s + i.stock * i.cost_price, 0),
  );
  readonly totalRetailValue = computed(() =>
    this._items().reduce((s, i) => s + i.stock * i.selling_price, 0),
  );

  /**
   * Primary entry point called on authenticated route activation.
   *
   * @param _shopId  Kept for API compatibility (InventoryComponent passes it).
   * @param force    When true, ignores lastSyncAt and fetches everything.
   */
  async load(_shopId: string, force = false): Promise<void> {
    // ── Step 1: populate UI instantly from IndexedDB ──────────────────────
    const cached = await this.localDb.getAllInventory();
    if (cached.length > 0) {
      this._items.set(cached);
    }

    // ── Step 2 + 3: delta sync from API ───────────────────────────────────
    this._loading.set(true);
    this._error.set(null);
    try {
      const lastSyncAt = force ? null : await this.localDb.getLastSyncAt(SYNC_KEY);
      const url = lastSyncAt
        ? `/api/v1/inventory?updatedAfter=${encodeURIComponent(lastSyncAt)}`
        : '/api/v1/inventory';

      const response = await this.api.get<{ items: InventoryItemRow[]; syncedAt: string }>(url);

      if (response.items.length > 0) {
        // ── Step 4: merge deltas into IDB and signal ─────────────────────
        await this.localDb.bulkUpsertInventory(response.items);

        // Rebuild the full list from IDB so deletions handled by Realtime
        // are correctly reflected (we only receive upserts from the API).
        const all = await this.localDb.getAllInventory();
        this._items.set(all);
      }

      // Advance cursor even if no rows changed — avoids re-fetching same window.
      await this.localDb.setLastSyncAt(SYNC_KEY, response.syncedAt);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to sync inventory.');
      // Non-fatal — the UI already shows cached data.
    } finally {
      this._loading.set(false);
    }
  }

  // ── Realtime / optimistic update helpers ─────────────────────────────────

  upsertItem(item: InventoryItemRow): void {
    this._items.update(items => {
      const idx = items.findIndex(i => i.id === item.id);
      if (idx === -1) return [...items, item];
      const next = [...items];
      next[idx] = item;
      return next;
    });
    void this.localDb.upsertInventoryItem(item);
  }

  removeItem(id: string): void {
    this._items.update(items => items.filter(i => i.id !== id));
    void this.localDb.removeInventoryItem(id);
  }

  patchItem(id: string, partial: Partial<InventoryItemRow>): void {
    this._items.update(items =>
      items.map(i => (i.id === id ? { ...i, ...partial } : i)),
    );
    const current = this._items().find(i => i.id === id);
    if (current) void this.localDb.upsertInventoryItem({ ...current, ...partial });
  }

  clear(): void {
    this._items.set([]);
    void this.localDb.clearInventory();
  }
}
