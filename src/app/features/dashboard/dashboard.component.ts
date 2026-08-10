import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { DecimalPipe, DatePipe, PercentPipe } from '@angular/common';
import {
  ShoppingBag, TrendingUp, Package, AlertTriangle, DollarSign,
  ShoppingCart, PackageCheck, Users, RefreshCw, Award, Clock,
  CreditCard, Smartphone, Wallet, BarChart2, ArrowRight,
} from 'lucide-angular';
import { LucideAngularModule } from 'lucide-angular';
import { StatCardComponent } from './stat-card.component';
import { RevenueChartComponent, type RevenueSeries } from './revenue-chart.component';
import { ShopStore } from '../../core/shop.store';
import { InventoryStore } from '../../core/inventory.store';
import { OrdersStore } from '../../core/orders.store';
import { ApiClient } from '../../core/api.client';
import { LocalDbService } from '../../core/local-db.service';
import { RouterLink } from '@angular/router';

export interface TopProduct {
  name:        string;
  revenue:     number;
  units_sold:  number;
  order_count: number;
}

export interface PaymentBreakdown {
  method: string;
  count:  number;
  total:  number;
}

export interface HourlyData {
  hour:        number;
  order_count: number;
  revenue:     number;
}

export interface DashboardStats {
  newOrders:           number;
  salesToday:          number;
  profitToday:         number;
  totalSales:          number;
  totalProfit:         number;
  totalOrders:         number;
  avgOrderValue:       number;
  totalCustomers:      number;
  repeatCustomers:     number;
  totalInventoryItems: number;
  outOfStockCount:     number;
  lowStockCount:       number;
  yesterday: { orders: number; sales: number; profit: number };
  revenueSeries:   RevenueSeries[];
  topProducts:     TopProduct[];
  paymentBreakdown: PaymentBreakdown[];
  hourlyData:      HourlyData[];
}

type RangeOption = 7 | 30 | 90;

