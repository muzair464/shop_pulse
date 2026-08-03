import {
  Component, inject, signal, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, ChangeDetectionStrategy,
} from '@angular/core';
import {
  Chart, LineController, LineElement, PointElement,
  LinearScale, CategoryScale, Filler, Tooltip, Legend,
} from 'chart.js';
import { ApiClient } from '../../core/api.client';
import { ShopStore } from '../../core/shop.store';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);

type RangeOption = 7 | 30 | 90;

interface ChartPoint { day: string; total_revenue: number; order_count: number; }

@Component({
  selector: 'app-revenue-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-gray-700">Overall Revenue</h3>
        <div class="flex gap-1" role="group" aria-label="Chart date range">
          @for (opt of rangeOptions; track opt.value) {
            <button type="button" (click)="setRange(opt.value)"
              [class.bg-primary-600]="range() === opt.value"
              [class.text-white]="range() === opt.value"
              [class.border-primary-600]="range() === opt.value"
              class="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200
                     text-gray-600 hover:bg-gray-50 transition-colors"
              [attr.aria-pressed]="range() === opt.value">
              {{ opt.label }}
            </button>
          }
        </div>
      </div>
      @if (loading()) {
        <div class="h-56 flex items-center justify-center">
          <span class="text-sm text-gray-400 animate-pulse">Loading chart…</span>
        </div>
      } @else {
        <div class="h-56 relative">
          <canvas #chartCanvas aria-label="Revenue and orders chart" role="img"></canvas>
        </div>
      }
    </div>
  `,
})
export class RevenueChartComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly api       = inject(ApiClient);
  private readonly shopStore = inject(ShopStore);

  @ViewChild('chartCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly range   = signal<RangeOption>(30);
  readonly loading = signal(false);

  private chart: Chart | null = null;
  private pendingData: ChartPoint[] | null = null;

  readonly rangeOptions = [
    { label: '7D', value: 7 as RangeOption },
    { label: '30D', value: 30 as RangeOption },
    { label: '90D', value: 90 as RangeOption },
  ];

  ngOnInit(): void { void this.loadData(); }

  ngAfterViewInit(): void {
    this.initChart();
    if (this.pendingData) { this.updateChart(this.pendingData); this.pendingData = null; }
  }

  ngOnDestroy(): void { this.chart?.destroy(); this.chart = null; }

  setRange(value: RangeOption): void { this.range.set(value); void this.loadData(); }

  private initChart(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    this.chart = new Chart(canvas, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 12 }, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.datasetIndex === 0
                ? ` Revenue: ${Number(ctx.raw).toLocaleString()}`
                : ` Orders: ${ctx.raw}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 10 } },
          yRevenue: { type: 'linear', position: 'left', grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
          yOrders: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { size: 11 }, stepSize: 1 } },
        },
      },
    });
  }

  private async loadData(): Promise<void> {
    if (!this.shopStore.shopId()) return;
    this.loading.set(true);
    try {
      const data = await this.api.get<{ revenueSeries: ChartPoint[] }>(
        `/api/v1/dashboard/stats?days=${this.range()}`,
      );
      const points = data.revenueSeries ?? [];
      if (this.chart) { this.updateChart(points); }
      else { this.pendingData = points; }
    } catch {
      // Chart load failure is non-critical
    } finally {
      this.loading.set(false);
    }
  }

  private updateChart(points: ChartPoint[]): void {
    if (!this.chart) return;
    this.chart.data.labels = points.map(d => {
      const dt = new Date(d.day);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    this.chart.data.datasets = [
      {
        label: 'Revenue', data: points.map(d => d.total_revenue),
        borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.08)',
        borderWidth: 2, pointRadius: 3, pointHoverRadius: 5,
        fill: true, tension: 0.4, yAxisID: 'yRevenue',
      },
      {
        label: 'Orders', data: points.map(d => d.order_count),
        borderColor: '#16a34a', backgroundColor: 'transparent',
        borderWidth: 2, pointRadius: 3, pointHoverRadius: 5,
        fill: false, tension: 0.4, borderDash: [4, 3], yAxisID: 'yOrders',
      },
    ];
    this.chart.update();
  }
}
