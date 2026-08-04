import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { LucideAngularModule, Eye, Printer, Filter } from 'lucide-angular';
import { OrdersStore } from '../../core/orders.store';
import { ShopStore } from '../../core/shop.store';
import { ApiClient } from '../../core/api.client';
import { BadgeComponent } from '../../shared/badge.component';
import { ShopStatsBarComponent } from '../../shared/shop-stats-bar.component';
import { PaginationComponent } from '../../shared/pagination.component';
import { ExportCsvButtonComponent } from '../../shared/export-csv-button.component';
import type { OrderRow } from '../../core/database.types';

type ChannelFilter = 'all' | 'POS' | 'ONLINE';
type MethodFilter  = 'all' | 'CASH' | 'CARD_KHATA' | 'DIGITAL_PAY';

interface OrderDetail extends OrderRow {
  order_items: Array<{
    id: string; name_snapshot: string;
    qty: number; unit_price: number; line_total: number;
  }>;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, LucideAngularModule,
    BadgeComponent, ShopStatsBarComponent, PaginationComponent, ExportCsvButtonComponent,
  ],
  template: `
    <div>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Orders</h1>
          <p class="mt-0.5 text-sm text-gray-500">{{ ordersStore.orders().length }} total orders</p>
        </div>
        <div class="flex items-center gap-2">
          <app-export-csv-button apiPath="/api/v1/orders/export" label="Export CSV" />
          <button type="button" (click)="filterOpen.set(!filterOpen())" class="btn-secondary"
            [attr.aria-expanded]="filterOpen()">
            <lucide-icon [img]="FilterIcon" size="15" aria-hidden="true" />
            Filters
            @if (hasActiveFilter()) {
              <span class="w-2 h-2 rounded-full bg-primary-500 ml-0.5"></span>
            }
          </button>
        </div>
      </div>

      <app-shop-stats-bar />

      @if (filterOpen()) {
        <div class="card p-4 mb-4 flex flex-wrap gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">Channel</label>
            <div class="flex gap-1">
              @for (opt of channelOptions; track opt.value) {
                <button type="button" (click)="channelFilter.set(opt.value)"
                  [class.bg-primary-600]="channelFilter() === opt.value"
                  [class.text-white]="channelFilter() === opt.value"
                  class="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  {{ opt.label }}
                </button>
              }
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">Payment</label>
            <div class="flex flex-wrap gap-1">
              @for (opt of methodOptions; track opt.value) {
                <button type="button" (click)="methodFilter.set(opt.value)"
                  [class.bg-primary-600]="methodFilter() === opt.value"
                  [class.text-white]="methodFilter() === opt.value"
                  class="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  {{ opt.label }}
                </button>
              }
            </div>
          </div>
        </div>
      }

      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white mb-4">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date &amp; Time</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Channel</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @if (ordersStore.loading()) {
                @for (i of [1,2,3,4,5]; track i) {
                  <tr class="animate-pulse">
                    @for (j of [1,2,3,4,5,6,7]; track j) {
                      <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                    }
                  </tr>
                }
              } @else if (pagedOrders().length === 0) {
                <tr>
                  <td colspan="7" class="px-4 py-12 text-center text-sm text-gray-400">No orders found.</td>
                </tr>
              } @else {
                @for (order of pagedOrders(); track order.id) {
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3">
                      <span class="font-mono text-sm font-semibold text-primary-700">{{ order.order_number }}</span>
                      @if (!order.payment_verified) {
                        <app-badge variant="yellow" class="ml-2">Unverified</app-badge>
                      }
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {{ order.created_at | date:'MMM d, y' }}<br/>
                      <span class="text-xs text-gray-400">{{ order.created_at | date:'h:mm a' }}</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-700">
                      {{ order.customer_name || '—' }}
                      @if (order.customer_phone) {
                        <div class="text-xs text-gray-400">{{ order.customer_phone }}</div>
                      }
                    </td>
                    <td class="px-4 py-3">
                      <app-badge [variant]="order.channel === 'POS' ? 'blue' : 'green'">{{ order.channel }}</app-badge>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ paymentLabel(order.payment_method) }}</td>
                    <td class="px-4 py-3 text-sm font-semibold text-gray-900 tabular-nums">
                      {{ order.total | number:'1.0-0' }}
                      @if (order.discount > 0) {
                        <div class="text-xs text-gray-400 font-normal">-{{ order.discount | number:'1.0-0' }} disc.</div>
                      }
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-1">
                        <button type="button" (click)="viewOrder(order)"
                          class="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          aria-label="View order">
                          <lucide-icon [img]="EyeIcon" size="14" aria-hidden="true" />
                        </button>
                        <button type="button" (click)="printOrder(order)"
                          class="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          aria-label="Print receipt">
                          <lucide-icon [img]="PrinterIcon" size="14" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <app-pagination
        [totalItems]="filteredOrders().length" [pageSize]="pageSize"
        [currentPage]="currentPage()" (pageChange)="currentPage.set($event)"
      />
    </div>

    @if (detailOrder()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        role="dialog" aria-modal="true" aria-label="Order details"
        (click)="detailOrder.set(null)">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          (click)="$event.stopPropagation()">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="font-semibold text-gray-900">Order {{ detailOrder()!.order_number }}</h2>
            <p class="text-xs text-gray-400 mt-0.5">{{ detailOrder()!.created_at | date:'MMMM d, y — h:mm a' }}</p>
          </div>
          <div class="p-6 space-y-4">
            <!-- Customer info -->
            @if (detailOrder()!.customer_name || detailOrder()!.customer_phone || detailOrder()!.customer_cnic) {
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase mb-2">Customer</p>
                <div class="space-y-0.5 text-sm text-gray-700">
                  @if (detailOrder()!.customer_name) {
                    <p>{{ detailOrder()!.customer_name }}</p>
                  }
                  @if (detailOrder()!.customer_phone) {
                    <p class="text-gray-500">{{ detailOrder()!.customer_phone }}</p>
                  }
                  @if (detailOrder()!.customer_cnic) {
                    <p class="text-gray-500">CNIC: {{ detailOrder()!.customer_cnic }}</p>
                  }
                </div>
              </div>
            }
            @if (detailOrder()!.order_items.length) {
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase mb-2">Items</p>
                @for (item of detailOrder()!.order_items; track item.id) {
                  <div class="flex justify-between text-sm py-1">
                    <span class="text-gray-700">{{ item.name_snapshot }} × {{ item.qty }}</span>
                    <span class="tabular-nums font-medium">{{ item.line_total | number:'1.0-0' }}</span>
                  </div>
                }
              </div>
            }
            <div class="border-t pt-3 space-y-1">
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">Subtotal</span>
                <span class="tabular-nums">{{ detailOrder()!.subtotal | number:'1.0-0' }}</span>
              </div>
              @if (detailOrder()!.discount > 0) {
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">Discount</span>
                  <span class="tabular-nums text-green-600">-{{ detailOrder()!.discount | number:'1.0-0' }}</span>
                </div>
              }
              <div class="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span class="tabular-nums">{{ detailOrder()!.total | number:'1.0-0' }}</span>
              </div>
            </div>
            <div class="text-xs text-gray-400 space-y-0.5">
              <p>Payment: {{ paymentLabel(detailOrder()!.payment_method) }}</p>
              <p>Channel: {{ detailOrder()!.channel }}</p>
              <p>Verified: {{ detailOrder()!.payment_verified ? 'Yes' : 'No (manual reconciliation needed)' }}</p>
            </div>
            <button type="button" (click)="detailOrder.set(null)" class="btn-secondary w-full justify-center">Close</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class OrdersComponent implements OnInit {
  readonly ordersStore = inject(OrdersStore);
  private readonly shopStore = inject(ShopStore);
  private readonly api = inject(ApiClient);

  readonly EyeIcon     = Eye;
  readonly PrinterIcon = Printer;
  readonly FilterIcon  = Filter;

  readonly filterOpen    = signal(false);
  readonly channelFilter = signal<ChannelFilter>('all');
  readonly methodFilter  = signal<MethodFilter>('all');
  readonly currentPage   = signal(0);
  readonly pageSize      = 20;
  readonly detailOrder   = signal<OrderDetail | null>(null);

  readonly channelOptions = [
    { value: 'all' as ChannelFilter, label: 'All' },
    { value: 'POS' as ChannelFilter, label: 'POS' },
    { value: 'ONLINE' as ChannelFilter, label: 'Online' },
  ];
  readonly methodOptions = [
    { value: 'all'          as MethodFilter, label: 'All' },
    { value: 'CASH'         as MethodFilter, label: 'Cash' },
    { value: 'CARD_KHATA'   as MethodFilter, label: 'Card/Khata' },
    { value: 'DIGITAL_PAY'  as MethodFilter, label: 'Digital Pay' },
  ];

  readonly hasActiveFilter = computed(() =>
    this.channelFilter() !== 'all' || this.methodFilter() !== 'all',
  );

  readonly filteredOrders = computed(() => {
    let orders = this.ordersStore.orders();
    const ch = this.channelFilter();
    const pm = this.methodFilter();
    if (ch !== 'all') orders = orders.filter(o => o.channel === ch);
    if (pm !== 'all') orders = orders.filter(o => o.payment_method === pm);
    return orders;
  });

  readonly pagedOrders = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.filteredOrders().slice(start, start + this.pageSize);
  });

  async ngOnInit(): Promise<void> {
    if (!this.shopStore.shopId()) await this.shopStore.load();
    const shopId = this.shopStore.shopId();
    if (shopId && this.ordersStore.orders().length === 0) {
      await this.ordersStore.load(shopId);
    }
  }

  async viewOrder(order: OrderRow): Promise<void> {
    const detail = await this.api.get<OrderDetail>(`/api/v1/orders/${order.id}`);
    this.detailOrder.set(detail);
  }

  printOrder(order: OrderRow): void {
    void this.viewOrder(order).then(() => setTimeout(() => window.print(), 100));
  }

  paymentLabel(method: string): string {
    return ({ CASH: 'Cash', CARD_KHATA: 'Card/Khata', DIGITAL_PAY: 'Digital Pay' } as Record<string, string>)[method] ?? method;
  }
}
