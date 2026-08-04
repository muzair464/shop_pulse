import {
  Component, inject, signal, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { ShoppingBag, Users, Wifi, WifiOff } from 'lucide-angular';
import { StatCardComponent } from './stat-card.component';
import { RevenueChartComponent } from './revenue-chart.component';
import { ShopStore } from '../../core/shop.store';
import { InventoryStore } from '../../core/inventory.store';
import { OrdersStore } from '../../core/orders.store';
import { ApiClient } from '../../core/api.client';
import { LocalDbService } from '../../core/local-db.service';

export interface DashboardStats {
  newOrders:           number;
  revenueToday:        number;
  totalInventoryItems: number;
  lowStockCount:       number;
  revenueSeries:       Array<{ day: string; total_revenue: number; order_count: number }>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatCardComponent, RevenueChartComponent],
  template: `
    <div>
      <div class="mb-6">
        <h1 class="text-xl font-bold text-gray-900">Dashboard</h1>
        <p class="mt-0.5 text-sm text-gray-500">
          Welcome back{{ shopName() ? ', ' + shopName() : '' }}
        </p>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <app-stat-card
          label="New Orders" [value]="stats().newOrders"
          [icon]="ShoppingBagIcon" subtext="Today"
          iconBgClass="bg-blue-100" iconColorClass="text-blue-600"
        />
        <app-stat-card
          label="Revenue Today" [value]="formatCurrency(stats().revenueToday)"
          [icon]="UsersIcon"
          iconBgClass="bg-green-100" iconColorClass="text-green-600"
        />
        <app-stat-card
          label="In Stock" [value]="inventory.inStockCount()"
          [icon]="WifiIcon" subtext="Items in stock"
          iconBgClass="bg-emerald-100" iconColorClass="text-emerald-600"
        />
        <app-stat-card
          label="Low Stock" [value]="inventory.lowStockCount()"
          [icon]="WifiOffIcon" subtext="Need restocking"
          iconBgClass="bg-yellow-100" iconColorClass="text-yellow-600"
        />
      </div>

      <app-revenue-chart />
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly shopStore = inject(ShopStore);
  readonly inventory         = inject(InventoryStore);
  private readonly orders    = inject(OrdersStore);
  private readonly api       = inject(ApiClient);
  private readonly localDb   = inject(LocalDbService);

  readonly ShoppingBagIcon = ShoppingBag;
  readonly UsersIcon       = Users;
  readonly WifiIcon        = Wifi;
  readonly WifiOffIcon     = WifiOff;
  readonly shopName        = this.shopStore.shopName;

  // Pre-seed from in-memory signals (already IDB-backed) for instant render.
  readonly stats = signal<DashboardStats>({
    newOrders:           this.orders.todaysOrderCount(),
    revenueToday:        this.orders.todaysRevenue(),
    totalInventoryItems: this.inventory.totalCount(),
    lowStockCount:       this.inventory.lowStockCount(),
    revenueSeries:       [],
  });

  async ngOnInit(): Promise<void> {
    const shopId = this.shopStore.shopId();
    if (!shopId) return;

    // Step 1: load cached stats from IDB instantly (includes revenueSeries).
    const cached = await this.localDb.getDashboardStats(shopId, 30);
    if (cached) {
      this.stats.set({
        newOrders:           cached.newOrders,
        revenueToday:        cached.revenueToday,
        totalInventoryItems: cached.totalInventoryItems,
        lowStockCount:       cached.lowStockCount,
        revenueSeries:       cached.revenueSeries,
      });
    }

    // Step 2: refresh from network in the background.
    void this._loadStats(shopId);
  }

  private async _loadStats(shopId: string): Promise<void> {
    try {
      const data = await this.api.get<DashboardStats>('/api/v1/dashboard/stats');
      const fresh: DashboardStats = {
        newOrders:           data.newOrders           ?? 0,
        revenueToday:        data.revenueToday         ?? 0,
        totalInventoryItems: data.totalInventoryItems  ?? 0,
        lowStockCount:       data.lowStockCount        ?? 0,
        revenueSeries:       data.revenueSeries        ?? [],
      };
      this.stats.set(fresh);
      // Persist to IDB so the next visit renders instantly.
      void this.localDb.putDashboardStats({
        shopId,
        days:                30,
        cachedAt:            new Date().toISOString(),
        ...fresh,
      });
    } catch {
      // Network unavailable — cached values already showing, nothing to do.
    }
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('en-PK', { maximumFractionDigits: 0 });
  }
}
