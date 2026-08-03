import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiClient } from './api.client';
import type { InventoryItemRow } from './database.types';

/**
 * InventoryStore — signal store for inventory items.
 *
 * Populated by an initial GET /api/v1/inventory call on route load.
 * Kept live by RealtimeSyncService patching it from /api/v1/ws/sync messages.
 * Consumed by InventoryComponent and PosComponent (catalog).
 */
@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private readonly api = inject(ApiClient);

  private readonly _items   = signal<InventoryItemRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _error   = signal<string | null>(null);

  readonly items       = this._items.asReadonly();
  readonly loading     = this._loading.asReadonly();
  readonly error       = this._error.asReadonly();
  readonly totalCount  = computed(() => this._items().length);
  readonly inStockCount = computed(() => this._items().filter(i => i.stock > 0).length);
  readonly lowStockCount = computed(() =>
    this._items().filter(i => i.stock > 0 && i.stock <= 5).length,
  );

  async load(_shopId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const data = await this.api.get<InventoryItemRow[]>('/api/v1/inventory');
      this._items.set(data ?? []);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load inventory.');
    } finally {
      this._loading.set(false);
    }
  }

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
