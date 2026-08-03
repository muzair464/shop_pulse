import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, Package, PackageCheck, AlertTriangle, TrendingUp } from 'lucide-angular';
import { InventoryStore } from '../core/inventory.store';
import { OrdersStore } from '../core/orders.store';

/**
 * ShopStatsBarComponent — shared stats bar shown on both Inventory and Orders pages.
 *
 * Displays four KPIs derived from signal stores:
 *  - Total items in inventory
 *  - In-stock items
 *  - Low-stock items (≤5)
 *  - Today's revenue
 *
 * Architecture note: this is modeled as a single shared component mounted on both
 * routes. Swapping in order-specific KPIs (Today's Sales, Avg. Order Value) is a
 * component-level change — the architecture document flags this as a future improvement.
 */
@Component({
  selector: 'app-shop-stats-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe],
  template: `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">

      <div class="card p-4 flex items-center gap-3">
        <div class="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
          <lucide-icon [img]="PackageIcon" size="18" class="text-blue-600" aria-hidden="true" />
        </div>
        <div>
          <p class="text-xs text-gray-500 font-medium">Total Items</p>
          <p class="text-xl font-bold text-gray-900 tabular-nums">{{ inventory.totalCount() }}</p>
        </div>
      </div>

      <div class="card p-4 flex items-center gap-3">
        <div class="flex-shrink-0 w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
          <lucide-icon [img]="PackageCheckIcon" size="18" class="text-green-600" aria-hidden="true" />
        </div>
        <div>
          <p class="text-xs text-gray-500 font-medium">In Stock</p>
          <p class="text-xl font-bold text-gray-900 tabular-nums">{{ inventory.inStockCount() }}</p>
        </div>
      </div>

      <div class="card p-4 flex items-center gap-3">
        <div class="flex-shrink-0 w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center">
          <lucide-icon [img]="AlertTriangleIcon" size="18" class="text-yellow-600" aria-hidden="true" />
        </div>
        <div>
          <p class="text-xs text-gray-500 font-medium">Low Stock</p>
          <p class="text-xl font-bold text-gray-900 tabular-nums">{{ inventory.lowStockCount() }}</p>
        </div>
      </div>

      <div class="card p-4 flex items-center gap-3">
        <div class="flex-shrink-0 w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
          <lucide-icon [img]="TrendingUpIcon" size="18" class="text-primary-600" aria-hidden="true" />
        </div>
        <div>
          <p class="text-xs text-gray-500 font-medium">Today's Revenue</p>
          <p class="text-xl font-bold text-gray-900 tabular-nums">
            {{ orders.todaysRevenue() | number:'1.0-0' }}
          </p>
        </div>
      </div>

    </div>
  `,
})
export class ShopStatsBarComponent {
  readonly inventory = inject(InventoryStore);
  readonly orders = inject(OrdersStore);

  readonly PackageIcon = Package;
  readonly PackageCheckIcon = PackageCheck;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly TrendingUpIcon = TrendingUp;
}
