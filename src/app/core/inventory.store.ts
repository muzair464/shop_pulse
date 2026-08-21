/**
 * inventory.store.ts — server-first signal store.
 *
 * Every load fetches directly from the API. No IndexedDB, no local cache.
 * Realtime patches from RealtimeSyncService keep the signal live while
 * the app is open.
 */
import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiClient } from './api.client';
import type { InventoryItemRow } from './database.types';

@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private readonly api = inject(ApiClient);

  private readonly _items   = signal<InventoryItemRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _error   = signal<string | null>(null);

  readonly items           = this._items.asReadonly();
  readonly loading         = this._loading.asReadonly();
  readonly error           = this._error.asReadonly();
  readonly totalCount      = computed(() => this._items().length);
  readonly inStockCount    = computed(() => this._items().filter(i => i.stock > 0).length);
  readonly outOfStockCount = computed(() => this._items().filter(i => i.stock === 0).length);
  readonly lowStockCount   = computed(() =>
    this._items().filter(i => i.stock > 0 && i.stock <= 5).length,
  );
  readonly totalStockValue = computed(() =>
    this._items().reduce((s, i) => s + i.stock * i.cost_price, 0),
  );
  readonly totalRetailValue = computed(() =>
    this._items().reduce((s, i) => s + i.stock * i.selling_price, 0),
  );

  /**
   * Fetch all inventory from the server and populate the signal.
   * @param _shopId  Kept for call-site compatibility — RLS on the backend handles scoping.
   */
  async load(_shopId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const response = await this.api.get<{ items: InventoryItemRow[]; syncedAt: string }>(
        '/api/v1/inventory',
      );
      this._items.set(response.items);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load inventory.');
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
  }

  removeItem(id: string): void {
    this._items.update(items => items.filter(i => i.id !== id));
  }

  patchItem(id: string, partial: Partial<InventoryItemRow>): void {
    this._items.update(items =>
      items.map(i => (i.id === id ? { ...i, ...partial } : i)),
    );
  }

  clear(): void {
    this._items.set([]);
  }
}
