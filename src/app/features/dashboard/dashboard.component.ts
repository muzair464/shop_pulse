import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import {
  ShoppingBag, TrendingUp, Package, AlertTriangle, DollarSign,
  ShoppingCart, PackageCheck, Users, Award, Clock,
  CreditCard, Smartphone, Wallet, BarChart2, ArrowRight, Zap,
  RefreshCw, Target, Activity,
} from 'lucide-angular';
import { StatCardComponent } from './stat-card.component';
import { RevenueChartComponent, type RevenueSeries } from './revenue-chart.component';
import { ApiClient } from '../../core/api.client';
import { ShopStore } from '../../core/shop.store';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface TopProduct {
  name: string; revenue: number; units_sold: number; order_count: number;
}
export interface PaymentBreakdown {
  method: string; count: number; total: number;
}
export interface HourlyData {
  hour: number; order_count: number; revenue: number;
}
export interface DashboardStats {
  newOrders: number; salesToday: number; profitToday: number;
  totalSales: number; totalProfit: number; totalOrders: number;
  avgOrderValue: number; totalCustomers: number; repeatCustomers: number;
  totalInventoryItems: number; outOfStockCount: number; lowStockCount: number;
  yesterday: { orders: number; sales: number; profit: number };
  revenueSeries: RevenueSeries[];
  topProducts: TopProduct[];
  paymentBreakdown: PaymentBreakdown[];
  hourlyData: HourlyData[];
}
type RangeOption = 7 | 30 | 90;

// ── Helper ────────────────────────────────────────────────────────────────────
function pctChange(today: number, yesterday: number): number | null {
  if (yesterday === 0) return today > 0 ? 100 : null;
  return ((today - yesterday) / yesterday) * 100;
}
function fmt(n: number): string {
  if (n >= 1_000_000) return `PKR ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `PKR ${(n / 1_000).toFixed(1)}K`;
  return `PKR ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}
function peakHour(data: HourlyData[]): string {
  const peak = data.reduce((a, b) => b.order_count > a.order_count ? b : a, data[0]);
  if (!peak || peak.order_count === 0) return 'N/A';
  const h = peak.hour;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${suffix}`;
}
function paymentLabel(method: string): string {
  const m: Record<string, string> = {
    CASH: 'Cash', CARD_KHATA: 'Card / Khata', DIGITAL_PAY: 'Digital Pay',
  };
  return m[method] ?? method;
}

// ── Component ─────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RouterLink, LucideAngularModule, StatCardComponent, RevenueChartComponent],
  template: `
<div class="space-y-6 pb-10">

  <!-- ── Page header ───────────────────────────────────────────────────────── -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-xl font-bold text-gray-900">Dashboard</h1>
      <p class="text-sm text-gray-500 mt-0.5">
        {{ shopStore.shopName() || 'Your shop' }} &mdash; overview for today
      </p>
    </div>
    <button type="button" (click)="refresh()"
      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200
             text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
      [disabled]="loading()" [attr.aria-busy]="loading()">
      <lucide-icon [img]="RefreshCwIcon" size="13"
        [class.animate-spin]="loading()" aria-hidden="true" />
      Refresh
    </button>
  </div>

  <!-- ── Error banner ──────────────────────────────────────────────────────── -->
  @if (error()) {
    <div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3
                text-sm text-red-700 flex items-center gap-2" role="alert">
      <lucide-icon [img]="AlertTriangleIcon" size="15" aria-hidden="true" />
      {{ error() }}
    </div>
  }

  <!-- ── Skeleton loader ───────────────────────────────────────────────────── -->
  @if (loading() && !stats()) {
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      @for (_ of [1,2,3,4]; track $index) {
        <div class="card p-5 animate-pulse space-y-3">
          <div class="w-10 h-10 rounded-xl bg-gray-100"></div>
          <div class="h-6 bg-gray-100 rounded w-3/4"></div>
          <div class="h-4 bg-gray-100 rounded w-1/2"></div>
        </div>
      }
    </div>
  }

  @if (stats(); as s) {

    <!-- ── Today's KPI row ──────────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <app-stat-card
        label="Orders Today"
        [value]="s.newOrders"
        [icon]="ShoppingBagIcon"
        iconBgClass="bg-blue-100" iconColorClass="text-blue-600"
        [subtext]="s.yesterday.orders + ' yesterday'"
        [trend]="trendOrders()" />
      <app-stat-card
        label="Revenue Today"
        [value]="fmt(s.salesToday)"
        [icon]="DollarSignIcon"
        iconBgClass="bg-green-100" iconColorClass="text-green-600"
        [subtext]="fmt(s.yesterday.sales) + ' yesterday'"
        [trend]="trendSales()" />
      <app-stat-card
        label="Profit Today"
        [value]="fmt(s.profitToday)"
        [icon]="TrendingUpIcon"
        iconBgClass="bg-violet-100" iconColorClass="text-violet-600"
        [subtext]="fmt(s.yesterday.profit) + ' yesterday'"
        [trend]="trendProfit()" />
      <app-stat-card
        label="Avg Order Value"
        [value]="fmt(s.avgOrderValue)"
        [icon]="TargetIcon"
        iconBgClass="bg-orange-100" iconColorClass="text-orange-600"
        [subtext]="s.totalOrders + ' total orders'" />
    </div>

    <!-- ── Revenue chart ────────────────────────────────────────────────────── -->
    <app-revenue-chart
      [series]="s.revenueSeries"
      [activeRange]="activeRange()"
      [loading]="loading()" />

    <!-- ── Middle row: top products + payment split ─────────────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

      <!-- Top products -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm font-semibold text-gray-800">Top Products</h3>
            <p class="text-xs text-gray-400 mt-0.5">By revenue, last {{ activeRange() }} days</p>
          </div>
          <lucide-icon [img]="AwardIcon" size="16" class="text-gray-300" aria-hidden="true" />
        </div>
        @if (!s.topProducts.length) {
          <p class="text-sm text-gray-400 py-6 text-center">No sales in this period.</p>
        } @else {
          <div class="space-y-3">
            @for (p of s.topProducts; track p.name; let i = $index) {
              <div class="flex items-center gap-3">
                <span class="w-5 text-xs font-bold tabular-nums shrink-0"
                  [class.text-yellow-500]="i === 0"
                  [class.text-gray-400]="i > 0">
                  {{ i + 1 }}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="text-xs font-medium text-gray-800 truncate">{{ p.name }}</span>
                    <span class="text-xs font-semibold text-gray-700 tabular-nums shrink-0">
                      {{ fmt(p.revenue) }}
                    </span>
                  </div>
                  <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div class="h-full rounded-full bg-blue-500 transition-all"
                      [style.width.%]="(p.revenue / s.topProducts[0].revenue) * 100"></div>
                  </div>
                  <p class="text-xs text-gray-400 mt-0.5">
                    {{ p.units_sold }} unit{{ p.units_sold === 1 ? '' : 's' }} &middot;
                    {{ p.order_count }} order{{ p.order_count === 1 ? '' : 's' }}
                  </p>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Payment method breakdown -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm font-semibold text-gray-800">Payment Methods</h3>
            <p class="text-xs text-gray-400 mt-0.5">Split for last {{ activeRange() }} days</p>
          </div>
          <lucide-icon [img]="CreditCardIcon" size="16" class="text-gray-300" aria-hidden="true" />
        </div>
        @if (!s.paymentBreakdown.length) {
          <p class="text-sm text-gray-400 py-6 text-center">No sales in this period.</p>
        } @else {
          <div class="space-y-3">
            @for (pm of s.paymentBreakdown; track pm.method) {
              <div>
                <div class="flex items-center justify-between mb-1 gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <lucide-icon [img]="paymentIcon(pm.method)" size="14"
                      class="text-gray-400 shrink-0" aria-hidden="true" />
                    <span class="text-xs font-medium text-gray-700 truncate">
                      {{ paymentLabel(pm.method) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="text-xs text-gray-400 tabular-nums">
                      {{ pm.count }} order{{ pm.count === 1 ? '' : 's' }}
                    </span>
                    <span class="text-xs font-semibold text-gray-800 tabular-nums">
                      {{ fmt(pm.total) }}
                    </span>
                  </div>
                </div>
                <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all"
                    [class]="paymentBarColor(pm.method)"
                    [style.width.%]="pmPct(pm, s.paymentBreakdown)"></div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>

    <!-- ── Bottom row: hourly heatmap + all-time summary ───────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

      <!-- Hourly activity heatmap -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm font-semibold text-gray-800">Hourly Activity</h3>
            <p class="text-xs text-gray-400 mt-0.5">
              Orders by hour &mdash; peak at {{ peakHourLabel(s.hourlyData) }}
            </p>
          </div>
          <lucide-icon [img]="ClockIcon" size="16" class="text-gray-300" aria-hidden="true" />
        </div>
        <div class="flex items-end gap-0.5 h-20">
          @for (h of s.hourlyData; track h.hour) {
            <div class="flex-1 flex flex-col items-center gap-0.5 group relative"
              [attr.aria-label]="hourLabel(h.hour) + ': ' + h.order_count + ' orders'">
              <div class="w-full rounded-sm transition-all"
                [style.height.%]="heatmapHeight(h, s.hourlyData)"
                [class]="heatmapColor(h, s.hourlyData)"
                style="min-height: 2px; max-height: 100%;">
              </div>
              <!-- Tooltip on hover -->
              <div class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10
                          hidden group-hover:flex flex-col items-center pointer-events-none">
                <div class="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow">
                  {{ hourLabel(h.hour) }}: {{ h.order_count }} orders
                </div>
                <div class="w-1.5 h-1.5 bg-gray-800 rotate-45 -mt-0.5"></div>
              </div>
            </div>
          }
        </div>
        <div class="flex justify-between mt-1">
          <span class="text-xs text-gray-400">12AM</span>
          <span class="text-xs text-gray-400">6AM</span>
          <span class="text-xs text-gray-400">12PM</span>
          <span class="text-xs text-gray-400">6PM</span>
          <span class="text-xs text-gray-400">11PM</span>
        </div>
      </div>

      <!-- All-time summary + inventory health -->
      <div class="card p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-800">Store Summary</h3>
          <lucide-icon [img]="ActivityIcon" size="16" class="text-gray-300" aria-hidden="true" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-gray-50 rounded-xl p-3">
            <p class="text-xs text-gray-500 mb-0.5">All-time Revenue</p>
            <p class="text-base font-bold text-gray-900 tabular-nums">{{ fmt(s.totalSales) }}</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3">
            <p class="text-xs text-gray-500 mb-0.5">All-time Profit</p>
            <p class="text-base font-bold text-gray-900 tabular-nums">{{ fmt(s.totalProfit) }}</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3">
            <p class="text-xs text-gray-500 mb-0.5">Total Customers</p>
            <p class="text-base font-bold text-gray-900 tabular-nums">{{ s.totalCustomers }}</p>
            <p class="text-xs text-gray-400">{{ s.repeatCustomers }} repeat</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3">
            <p class="text-xs text-gray-500 mb-0.5">Total Orders</p>
            <p class="text-base font-bold text-gray-900 tabular-nums">{{ s.totalOrders }}</p>
          </div>
        </div>

        <!-- Inventory health -->
        <div class="border-t border-gray-100 pt-3 space-y-2">
          <p class="text-xs font-semibold text-gray-600">Inventory Health</p>
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-500">Total SKUs</span>
            <span class="font-semibold text-gray-800">{{ s.totalInventoryItems }}</span>
          </div>
          @if (s.lowStockCount > 0) {
            <div class="flex items-center justify-between text-xs">
              <span class="flex items-center gap-1 text-amber-600">
                <lucide-icon [img]="AlertTriangleIcon" size="11" aria-hidden="true" />
                Low stock (&le;5 units)
              </span>
              <a routerLink="/inventory"
                class="font-semibold text-amber-600 hover:underline flex items-center gap-0.5">
                {{ s.lowStockCount }} items
                <lucide-icon [img]="ArrowRightIcon" size="11" aria-hidden="true" />
              </a>
            </div>
          }
          @if (s.outOfStockCount > 0) {
            <div class="flex items-center justify-between text-xs">
              <span class="flex items-center gap-1 text-red-600">
                <lucide-icon [img]="PackageCheckIcon" size="11" aria-hidden="true" />
                Out of stock
              </span>
              <a routerLink="/inventory"
                class="font-semibold text-red-600 hover:underline flex items-center gap-0.5">
                {{ s.outOfStockCount }} items
                <lucide-icon [img]="ArrowRightIcon" size="11" aria-hidden="true" />
              </a>
            </div>
          }
          @if (s.lowStockCount === 0 && s.outOfStockCount === 0) {
            <div class="flex items-center gap-1.5 text-xs text-green-600">
              <lucide-icon [img]="PackageCheckIcon" size="11" aria-hidden="true" />
              All items in stock
            </div>
          }
        </div>
      </div>

    </div>
  }

</div>
  `,
})
