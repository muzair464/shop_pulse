import { Injectable, inject, OnDestroy } from '@angular/core';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { ShopStore } from './shop.store';
import { InventoryStore } from './inventory.store';
import { OrdersStore } from './orders.store';
import type { InventoryItemRow, OrderRow } from './database.types';

/**
 * Public Supabase credentials — safe to ship in the browser bundle.
 * The anon key has only the permissions granted by your RLS policies.
 * The service role key NEVER appears here (it lives in the Next.js backend only).
 *
 * These are injected at build time via angular.json define.
 * Declare them so TypeScript compiles; esbuild replaces at build time.
 */
declare const SUPABASE_URL: string;
declare const SUPABASE_ANON_KEY: string;

function getSupabaseUrl():    string { try { return SUPABASE_URL; }    catch { return ''; } }
function getSupabaseAnonKey(): string { try { return SUPABASE_ANON_KEY; } catch { return ''; } }

/**
 * RealtimeSyncService — root-provided; one Supabase Realtime connection per session.
 *
 * Replaces the custom WebSocket/pg LISTEN layer from the Express backend.
 * Supabase Realtime pushes postgres_changes events for inventory_items,
 * orders, and shops directly to this Angular service.
 *
 * Device revocation is handled via a private Broadcast channel keyed
 * to the device ID — the Next.js backend broadcasts to it when a device
 * is revoked from Settings on another device.
 *
 * Message shapes:
 *   postgres_changes: { schema, table, eventType, new, old, errors }
 *   broadcast (device channel): { event: 'session_revoked' }
 */
@Injectable({ providedIn: 'root' })
export class RealtimeSyncService implements OnDestroy {
  private readonly auth           = inject(AuthService);
  private readonly shopStore      = inject(ShopStore);
  private readonly inventoryStore = inject(InventoryStore);
  private readonly ordersStore    = inject(OrdersStore);

  private supabase: SupabaseClient | null = null;
  private dbChannel: RealtimeChannel | null = null;
  private deviceChannel: RealtimeChannel | null = null;
  private shopId   = '';
  private deviceId = '';

  start(shopId: string, deviceId?: string): void {
    if (this.dbChannel) return; // already running
    this.shopId   = shopId;
    this.deviceId = deviceId ?? '';

    this.supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      realtime: { params: { eventsPerSecond: 10 } },
    });

    // ── Postgres changes channel ──────────────────────────────────────────
    this.dbChannel = this.supabase
      .channel(`shop:${shopId}`)
      // inventory_items
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'inventory_items', filter: `shop_id=eq.${shopId}` }, payload => this._onInventory(payload))
      // orders (INSERT only — no edits to committed orders)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders',          filter: `shop_id=eq.${shopId}` }, payload => this._onOrder(payload))
      // shops (settings changes)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shops',           filter: `id=eq.${shopId}` },     payload => this._onShop(payload))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          // Re-fetch all stores on subscribe as a correctness backstop.
          void this._refetchAll();
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

  // ── Postgres change handlers ────────────────────────────────────────────

  private _onInventory(payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }): void {
    const { eventType, new: row, old } = payload;
    if (eventType === 'DELETE') {
      const id = (old['id'] ?? row['id']) as string | undefined;
      if (id) this.inventoryStore.removeItem(id);
    } else {
      this.inventoryStore.upsertItem(row as unknown as InventoryItemRow);
    }
  }

  private _onOrder(payload: { new: Record<string, unknown> }): void {
    this.ordersStore.prependOrder(payload.new as unknown as OrderRow);
  }

  private _onShop(payload: { new: Record<string, unknown> }): void {
    this.shopStore.patch(payload.new);
  }

  private async _refetchAll(): Promise<void> {
    await Promise.all([
      this.inventoryStore.load(this.shopId),
      this.ordersStore.load(this.shopId),
      this.shopStore.load(),
    ]);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
