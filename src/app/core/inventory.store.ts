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
   * Fetch ALL inventory from the server, paginating through every page.
   *
   * Strategy:
   *  1. Request page 1 first — the response now includes `total` so we know
   *     upfront how many rows to expect.
   *  2. Keep fetching page 2, 3 … until accumulated items >= total, or until
   *     a page returns fewer than PAGE_SIZE items (signals the last page).
   *  3. Hard cap at MAX_PAGES (50) to prevent infinite loops.
   *  4. On any mid-loop error: preserve already-fetched rows in the store and
   *     surface a descriptive message via `_error`.
   *
   * @param _shopId  Kept for call-site compatibility — RLS on the backend handles scoping.
   */
  async load(_shopId: string): Promise<void> {
    const PAGE_SIZE = 500; // must match server PAGE_SIZE
    const MAX_PAGES = 50;

    this._loading.set(true);
    this._error.set(null);

    const accumulated: InventoryItemRow[] = [];
    let total: number | null = null;

    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        let response: { items: InventoryItemRow[]; total: number; syncedAt: string };
        try {
          response = await this.api.get<{ items: InventoryItemRow[]; total: number; syncedAt: string }>(
            `/api/v1/inventory?page=${page}`,
          );
        } catch (err) {
          // Partial failure: keep what we already have, surface the error.
          const msg = err instanceof Error ? err.message : 'Failed to load inventory.';
          this._error.set(
            accumulated.length > 0
              ? `Loaded ${accumulated.length} of ${total ?? '?'} items. Stopped on page ${page}: ${msg}`
              : msg,
          );
          break; // exit loop; accumulated items (if any) are set below
        }

        accumulated.push(...response.items);

        // Capture total from the first page so we can use it every iteration.
        if (total === null) {
          total = response.total;
        }

        // Stop conditions:
        // (a) We have at least as many rows as the server says exist.
        if (total !== null && accumulated.length >= total) break;
        // (b) This page was smaller than PAGE_SIZE — it was the last page.
        if (response.items.length < PAGE_SIZE) break;
      }
    } finally {
      // Always commit whatever we managed to fetch before setting loading=false.
      if (accumulated.length > 0) {
        this._items.set(accumulated);
      }
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
