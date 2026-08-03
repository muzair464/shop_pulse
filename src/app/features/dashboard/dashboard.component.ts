import {
  Component, inject, signal, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { ShoppingBag, Users, Wifi, WifiOff } from 'lucide-angular';
import { StatCardComponent } from './stat-card.component';
import { RevenueChartComponent } from './revenue-chart.component';
import { ShopStore } from '../../core/shop.store';
import { InventoryStore } from '../../core/inventory.store';
import { ApiClient } from '../../core/api.client';

interface DashboardStats {
  newOrders: number;
  revenueToday: number;
  totalInventoryItems: number;
  lowStockCount: number;
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
          label="Online" [value]="inventory.inStockCount()"
          [icon]="WifiIcon" subtext="Items in stock"
          iconBgClass="bg-emerald-100" iconColorClass="text-emerald-600"
        />
        <app-stat-card
          label="Low Stock" [value]="stats().lowStockCount"
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
  private readonly api       = inject(ApiClient);
  readonly inventory         = inject(InventoryStore);

  readonly ShoppingBagIcon = ShoppingBag;
  readonly UsersIcon       = Users;
  readonly WifiIcon        = Wifi;
  readonly WifiOffIcon     = WifiOff;

  readonly shopName = this.shopStore.shopName;

  readonly stats = signal<DashboardStats>({
    newOrders: 0, revenueToday: 0,
    totalInventoryItems: 0, lowStockCount: 0,
  });

  async ngOnInit(): Promise<void> {
    if (!this.shopStore.shopId()) await this.shopStore.load();
    const shopId = this.shopStore.shopId();
    if (!shopId) return;

    if (this.inventory.items().length === 0) await this.inventory.load(shopId);

    try {
      const data = await this.api.get<DashboardStats & { revenueSeries: unknown[] }>(
        '/api/v1/dashboard/stats',
      );
      this.stats.set({
        newOrders: data.newOrders ?? 0,
        revenueToday: data.revenueToday ?? 0,
        totalInventoryItems: data.totalInventoryItems ?? 0,
        lowStockCount: data.lowStockCount ?? 0,
      });
    } catch {
      // Stats are non-critical — silently ignore
    }
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('en-PK', { maximumFractionDigits: 0 });
  }
}
