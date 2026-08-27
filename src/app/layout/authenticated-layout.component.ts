/**
 * authenticated-layout.component.ts
 *
 * Shell for all protected routes.
 *
 * Eagerly preloads ALL three stores on mount so that:
 *  1. IndexedDB data renders instantly (from the store's IDB-first load).
 *  2. Delta syncs run in parallel — no per-page waterfall loading.
 *  3. Supabase Realtime starts as soon as we have a shopId.
 *
 * Route-level components (Dashboard, POS, Inventory, Orders) still call
 * their store's load() on init, but those calls are instant no-ops after
 * the first load because IDB is already populated and the delta cursor
 * is up-to-date.
 */
import { Component, OnInit, inject, effect, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { TopNavComponent } from './top-nav.component';
import { ToastContainerComponent } from '../shared/toast-container.component';
import { ShopStore } from '../core/shop.store';
import { InventoryStore } from '../core/inventory.store';
import { OrdersStore } from '../core/orders.store';
import { RealtimeSyncService } from '../core/realtime-sync.service';
import { AuthService } from '../core/auth.service';
import { BackupService } from '../core/backup.service';

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [RouterOutlet, TopNavComponent, ToastContainerComponent],
  template: `
    <div class="min-h-screen bg-surface">
      <app-top-nav />
      <main
        class="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 pb-20 md:pb-8"
        [class.pt-4]="!isPosRoute"
        [class.md:pt-8]="!isPosRoute"
        [class.pt-2]="isPosRoute"
        [class.md:pt-4]="isPosRoute"
      >
        <router-outlet />
      </main>
      <app-toast-container />
    </div>
  `,
})
export class AuthenticatedLayoutComponent implements OnInit, OnDestroy {
  private readonly auth           = inject(AuthService);
  private readonly shopStore      = inject(ShopStore);
  private readonly inventoryStore = inject(InventoryStore);
  private readonly ordersStore    = inject(OrdersStore);
  private readonly realtime       = inject(RealtimeSyncService);
  private readonly router         = inject(Router);
  private readonly backupService  = inject(BackupService);

  isPosRoute = false;
  private routerSub?: Subscription;

  constructor() {
    // Start Realtime as soon as shopId becomes available.
    effect(() => {
      const shopId = this.shopStore.shopId();
      if (shopId) this.realtime.start(shopId);
    });
  }

  async ngOnInit(): Promise<void> {
    // Track POS route for tighter padding.
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(e => {
        this.isPosRoute = (e as NavigationEnd).urlAfterRedirects.startsWith('/pos');
      });
    this.isPosRoute = this.router.url.startsWith('/pos');

    // ── Eager parallel preload ────────────────────────────────────────────
    // Each store reads from IDB first (instant) then delta-syncs from API.
    // All three run in parallel so the user sees data within ~1 network RTT.
    const shopId = this.auth.currentShop()?.id ?? '';
    await Promise.all([
      this.shopStore.load(),
      this.inventoryStore.load(shopId),
      this.ordersStore.load(shopId),
    ]);

    // Daily backup — runs silently in background after stores are ready.
    // Uses localStorage to ensure it only triggers once per calendar day.
    void this.backupService.runDailyIfNeeded();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
