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

interface DashboardStats {
  newOrders:           number;
  revenueToday:        number;
  totalInventoryItems: number;
  lowStockCount:       number;
  revenueSeries:       unknown[];
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
  // Stores are already loaded by AuthenticatedLayoutComponent — read signals directly.
  private readonly shopStore = inject(ShopStore);
  readonly inventory         = inject(InventoryStore);
  private readonly orders    = inject(OrdersStore);
  private readonly api       = inject(ApiClient);

  readonly ShoppingBagIcon = ShoppingBag;
  readonly UsersIcon       = Users;
  readonly WifiIcon        = Wifi;
  readonly WifiOffIcon     = WifiOff;
  readonly shopName        = this.shopStore.shopName;

  // Stats are pre-seeded from the already-loaded signals so the page
  // renders instantly. The network call updates them in the background.
  readonly stats = signal<DashboardStats>({
    newOrders:           this.orders.todaysOrderCount(),
    revenueToday:        this.orders.todaysRevenue(),
    totalInventoryItems: this.inventory.totalCount(),
    lowStockCount:       this.inventory.lowStockCount(),
    revenueSeries:       [],
  });

  ngOnInit(): void {
    // Fire the stats request in the background — does NOT block rendering.
    // The page is already showing data from cached signals above.
    void this._loadStats();
  }

  private async _loadStats(): Promise<void> {
    try {
      const data = await this.api.get<DashboardStats>('/api/v1/dashboard/stats');
      this.stats.set({
        newOrders:           data.newOrders           ?? 0,
        revenueToday:        data.revenueToday         ?? 0,
        totalInventoryItems: data.totalInventoryItems  ?? 0,
        lowStockCount:       data.lowStockCount        ?? 0,
        revenueSeries:       data.revenueSeries        ?? [],
      });
    } catch {
      // Non-critical — cached values from signals remain on screen.
    }
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('en-PK', { maximumFractionDigits: 0 });
  }
}
