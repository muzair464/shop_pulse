import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import {
  ShoppingBag, TrendingUp, Package, AlertTriangle, DollarSign,
  ShoppingCart, PackageCheck, Users, RefreshCw, Award, Clock,
  CreditCard, Smartphone, Wallet, BarChart2, ArrowRight, Zap,
} from 'lucide-angular';
import { StatCardComponent } from './stat-card.component';
import { RevenueChartComponent, type RevenueSeries } from './revenue-chart.component';
import { ApiClient } from '../../core/api.client';
import { ShopStore } from '../../core/shop.store';
