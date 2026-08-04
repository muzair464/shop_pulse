/**
 * realtime-sync.service.ts
 *
 * One Supabase Realtime WebSocket per authenticated session.
 * Subscribes to postgres_changes for inventory_items, orders, and shops.
 *
 * Key changes from original:
 *  - _refetchAll uses delta sync (passes shopId + respects IDB cursors)
 *    instead of doing full reloads on every reconnect.
 *  - All upsert/remove helpers in InventoryStore and OrdersStore now
 *    write through to IndexedDB, so Realtime events are persisted.
 */
import { Injectable, inject, OnDestroy } from '@angular/core';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { ShopStore } from './shop.store';
import { InventoryStore } from './inventory.store';
import { OrdersStore } from './orders.store';
import type { InventoryItemRow, OrderRow } from './database.types';

declare const SUPABASE_URL:      string;
declare const SUPABASE_ANON_KEY: string;

function getUrl():     string { try { return SUPABASE_URL;      } catch { return ''; } }
function getAnonKey(): string { try { return SUPABASE_ANON_KEY; } catch { return ''; } }

@Injectable({ providedIn: 'root' })
export class RealtimeSyncService implements OnDestroy {
  private readonly auth           = inject(AuthService);
  private readonly shopStore      = inject(ShopStore);
  private readonly inventoryStore = inject(InventoryStore);
  private readonly ordersStore    = inject(OrdersStore);

  private supabase:      SupabaseClient   | null = null;
  private dbChannel:     RealtimeChannel  | null = null;
  private deviceChannel: RealtimeChannel  | null = null;
  private shopId   = '';
  private deviceId = '';

  start(shopId: string, deviceId?: string): void {
    if (this.dbChannel) return; // already running
    this.shopId   = shopId;
    this.deviceId = deviceId ?? '';

    this.supabase = createClient(getUrl(), getAnonKey(), {
      realtime: { params: { eventsPerSecond: 10 } },
    });

    // ── Postgres changes channel ──────────────────────────────────────────
    this.dbChannel = this.supabase
      .channel(`shop:${shopId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_items', filter: `shop_id=eq.${shopId}` },
        payload => this._onInventory(payload),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` },
        payload => this._onOrder(payload),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shops', filter: `id=eq.${shopId}` },
        payload => this._onShop(payload),
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          // On reconnect, use delta sync so we only fetch rows that
          // changed while the WebSocket was disconnected.
          void this._refetchDeltas();
        }
      });

    // ── Device revocation broadcast channel ──────────────────────────────
    if (this.deviceId) {
      this.deviceChannel = this.supabase
        .channel(`device:${this.deviceId}`)
        .on('broadcast', { event: 'session_revoked' }, () => {
          void this.auth.signOut();
        })
        .subscribe();
    }
  }

  stop(): void {
    if (this.supabase) {
      if (this.dbChannel)     void this.supabase.removeChannel(this.dbChannel);
      if (this.deviceChannel) void this.supabase.removeChannel(this.deviceChannel);
      this.dbChannel     = null;
      this.deviceChannel = null;
      this.supabase      = null;
    }
  }

  // ── Postgres change handlers ──────────────────────────────────────────────

  private _onInventory(payload: {
    eventType: string;
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }): void {
    const { eventType, new: row, old } = payload;
    if (eventType === 'DELETE') {
      const id = (old['id'] ?? row['id']) as string | undefined;
      if (id) this.inventoryStore.removeItem(id); // also removes from IDB
    } else {
      this.inventoryStore.upsertItem(row as unknown as InventoryItemRow); // also writes IDB
    }
  }

  private _onOrder(payload: { new: Record<string, unknown> }): void {
    // prependOrder writes through to IDB automatically.
    this.ordersStore.prependOrder(payload.new as unknown as OrderRow);
  }

  private _onShop(payload: { new: Record<string, unknown> }): void {
    // ShopStore.patch writes through to IDB automatically.
    this.shopStore.patch(payload.new);
  }

  /**
   * Called on SUBSCRIBED — re-syncs only rows that changed since the
   * last known cursor in IndexedDB, not a full reload.
   */
  private async _refetchDeltas(): Promise<void> {
    await Promise.all([
      // force=false → reads IDB cursor → fetches only new/updated rows
      this.inventoryStore.load(this.shopId, false),
      this.ordersStore.load(this.shopId, false),
      // ShopStore always does a full refresh (settings are tiny)
      this.shopStore.load(),
    ]);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
