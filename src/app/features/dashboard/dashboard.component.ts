import {
  Component, inject, signal, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  ShoppingBag, TrendingUp, Package, AlertTriangle,
  DollarSign, ShoppingCart, PackageCheck, BarChart2,
} from 'lucide-angular';
import { LucideAngularModule } from 'lucide-angular';
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
  imports: [DecimalPipe, LucideAngularModule, StatCardComponent, RevenueChartComponent],
  template: `
    <div>
      <div class="mb-6">
        <h1 class="text-xl font-bold text-gray-900">Dashboard</h1>
        <p class="mt-0.5 text-sm text-gray-500">
          Welcome back{{ shopName() ? ', ' + shopName() : '' }}
        </p>
      </div>

      <!-- Row 1: Today's live stats from server -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <app-stat-card label="Today's Orders" [value]="stats().newOrders"
          [icon]="ShoppingBagIcon" subtext="since midnight"
          iconBgClass="bg-blue-100" iconColorClass="text-blue-600" />
        <app-stat-card label="Today's Revenue" [value]="formatCurrency(stats().revenueToday)"
          [icon]="DollarSignIcon" subtext="PKR"
          iconBgClass="bg-green-100" iconColorClass="text-green-600" />
        <app-stat-card label="In Stock" [value]="inventory.inStockCount()"
          [icon]="PackageCheckIcon" subtext="items available"
          iconBgClass="bg-emerald-100" iconColorClass="text-emerald-600" />
        <app-stat-card label="Low Stock" [value]="stats().lowStockCount"
          [icon]="AlertTriangleIcon" subtext="need restocking"
          iconBgClass="bg-yellow-100" iconColorClass="text-yellow-600" />
      </div>

      <!-- Row 2: Cumulative stats from local stores -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <app-stat-card label="Total Orders" [value]="orders.totalOrderCount()"
          [icon]="ShoppingCartIcon" subtext="all time"
          iconBgClass="bg-indigo-100" iconColorClass="text-indigo-600" />
        <app-stat-card label="Total Revenue" [value]="formatCurrency(orders.totalRevenue())"
          [icon]="TrendingUpIcon" subtext="all time"
          iconBgClass="bg-primary-100" iconColorClass="text-primary-600" />
        <app-stat-card label="Avg. Order Value" [value]="formatCurrency(orders.avgOrderValue())"
          [icon]="BarChart2Icon" subtext="per order"
          iconBgClass="bg-pink-100" iconColorClass="text-pink-600" />
        <app-stat-card label="Total Items" [value]="inventory.totalCount()"
          [icon]="PackageIcon" subtext="in catalog"
          iconBgClass="bg-orange-100" iconColorClass="text-orange-600" />
      </div>

      <!-- Revenue chart -->
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

  readonly ShoppingBagIcon  = ShoppingBag;
  readonly DollarSignIcon   = DollarSign;
  readonly PackageCheckIcon = PackageCheck;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly ShoppingCartIcon = ShoppingCart;
  readonly TrendingUpIcon   = TrendingUp;
  readonly BarChart2Icon    = BarChart2;
  readonly PackageIcon      = Package;
  readonly shopName        = this.shopStore.shopName;

  /**
   * Starts empty — populated in ngOnInit from IDB then overwritten by
   * the network response.  Using a plain signal (not a class-field initializer
   * snapshot) ensures OnPush marks the view dirty on every set().
   */
  readonly stats = signal<DashboardStats>({
    newOrders:           0,
    revenueToday:        0,
    totalInventoryItems: 0,
    lowStockCount:       0,
    revenueSeries:       [],
  });

  async ngOnInit(): Promise<void> {
    // shopStore.shopId() may be null on a hard refresh because the layout's
    // shopStore.load() runs concurrently with this component's init.
    // Solution: if shopId isn't ready yet, wait for shopStore.load() to
    // complete (it resolves quickly from IDB cache), then proceed.
    let shopId = this.shopStore.shopId();
    if (!shopId) {
      await this.shopStore.load();
      shopId = this.shopStore.shopId();
    }
    if (!shopId) return; // truly not authenticated — guard should have caught this

    // ── Step 1: seed from IDB cache instantly ──────────────────────────────
    const cached = await this.localDb.getDashboardStats(shopId, 30);
    if (cached) {
      this.stats.set({
        newOrders:           cached.newOrders,
        revenueToday:        cached.revenueToday,
        totalInventoryItems: cached.totalInventoryItems,
        lowStockCount:       cached.lowStockCount,
        revenueSeries:       cached.revenueSeries,
      });
    } else {
      this.stats.set({
        newOrders:           this.orders.todaysOrderCount(),
        revenueToday:        this.orders.todaysRevenue(),
        totalInventoryItems: this.inventory.totalCount(),
        lowStockCount:       this.inventory.lowStockCount(),
        revenueSeries:       [],
      });
    }

    // ── Step 2: always fetch fresh from server ─────────────────────────────
    await this._loadStats(shopId);
  }

  private async _loadStats(shopId: string): Promise<void> {
    try {
      // Pass the client's UTC offset so the server counts "today" in local time.
      const tzOffset = new Date().getTimezoneOffset(); // minutes behind UTC (PKT = -300)
      const data = await this.api.get<DashboardStats>(
        `/api/v1/dashboard/stats?tzOffset=${tzOffset}`,
      );
      const fresh: DashboardStats = {
        newOrders:           data.newOrders           ?? 0,
        revenueToday:        data.revenueToday         ?? 0,
        totalInventoryItems: data.totalInventoryItems  ?? 0,
        lowStockCount:       data.lowStockCount        ?? 0,
        revenueSeries:       data.revenueSeries        ?? [],
      };
      // Always update signal — this overwrites any stale IDB data.
      this.stats.set(fresh);
      // Persist fresh result to IDB for next visit.
      void this.localDb.putDashboardStats({
        shopId, days: 30,
        cachedAt: new Date().toISOString(),
        ...fresh,
      });
    } catch {
      // Network unavailable — IDB/signal values already on screen.
    }
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('en-PK', { maximumFractionDigits: 0 });
  }
}
