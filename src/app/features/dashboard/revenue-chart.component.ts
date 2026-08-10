import {
  Component, inject, signal, input, OnChanges, SimpleChanges,
  AfterViewInit, OnDestroy, ElementRef, ViewChild, ChangeDetectionStrategy,
} from '@angular/core';
import {
  Chart, LineController, BarController, LineElement, BarElement,
  PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend,
} from 'chart.js';

Chart.register(
  LineController, BarController, LineElement, BarElement,
  PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend,
);

export interface RevenueSeries {
  day:           string;
  total_revenue: number;
  order_count:   number;
  avg_order:     number;
}

type RangeOption = 7 | 30 | 90;

@Component({
  selector: 'app-revenue-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card p-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 class="text-sm font-semibold text-gray-800">Revenue &amp; Orders</h3>
          <p class="text-xs text-gray-400 mt-0.5">Daily breakdown for the selected period</p>
        </div>
        <div class="flex gap-1" role="group" aria-label="Chart date range">
          @for (opt of rangeOptions; track opt.value) {
            <button type="button" (click)="rangeChange.emit(opt.value)"
              [class.bg-primary-600]="activeRange() === opt.value"
              [class.text-white]="activeRange() === opt.value"
              [class.border-primary-600]="activeRange() === opt.value"
              class="px-3 py-1 text-xs font-semibold rounded-lg border border-gray-200
                     text-gray-600 hover:bg-gray-50 transition-colors"
              [attr.aria-pressed]="activeRange() === opt.value">
              {{ opt.label }}
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="h-64 flex items-center justify-center">
          <div class="flex flex-col items-center gap-2">
            <div class="w-8 h-8 border-2 border-primary-200 border-t-primary-600
                        rounded-full animate-spin"></div>
            <span class="text-xs text-gray-400">Loading chart…</span>
          </div>
        </div>
      } @else if (!series().length) {
        <div class="h-64 flex items-center justify-center">
          <p class="text-sm text-gray-400">No sales data for this period.</p>
        </div>
      } @else {
        <div class="h-64 relative">
          <canvas #chartCanvas aria-label="Revenue and orders trend" role="img"></canvas>
        </div>
      }
    </div>
  `,
})
export class RevenueChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  readonly series      = input<RevenueSeries[]>([]);
  readonly activeRange = input<RangeOption>(30);
  readonly loading     = input(false);

  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly rangeChange = new (class extends EventTarget {
    emit(v: RangeOption) { this.dispatchEvent(new CustomEvent('change', { detail: v })); }
  })();

  // We expose rangeChange as an Angular output via EventEmitter pattern
  // but keep it simple — parent listens via (rangeChange) binding.
  // Re-export as a proper output:
  private _rangeChangeCb: ((v: RangeOption) => void) | null = null;

  @ViewChild('chartCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly rangeOptions = [
    { label: '7D',  value: 7  as RangeOption },
    { label: '30D', value: 30 as RangeOption },
    { label: '90D', value: 90 as RangeOption },
  ];

  private chart: Chart | null = null;

  ngAfterViewInit(): void {
    this.initChart();
    if (this.series().length) this.renderChart(this.series());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['series'] && this.chart) {
      this.renderChart(this.series());
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private initChart(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;

    // Gradient fill for revenue line
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, 'rgba(37,99,235,0.18)');
    gradient.addColorStop(1, 'rgba(37,99,235,0)');

    this.chart = new Chart(canvas, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction:         { mode: 'index', intersect: false },
        animation:           { duration: 400 },
        plugins: {
          legend: {
            position: 'top',
            align:    'end',
            labels:   { boxWidth: 10, font: { size: 11 }, usePointStyle: true, padding: 16 },
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            titleFont:       { size: 12, weight: 'bold' },
            bodyFont:        { size: 12 },
            padding:         10,
            cornerRadius:    8,
            callbacks: {
              label: (ctx) => {
                if (ctx.datasetIndex === 0) return `  Revenue: PKR ${Number(ctx.raw).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
                return `  Orders: ${ctx.raw}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid:  { display: false },
            border: { display: false },
            ticks: { font: { size: 11 }, color: '#9ca3af', maxTicksLimit: 10, maxRotation: 0 },
          },
          yRevenue: {
            type:     'linear',
            position: 'left',
            grid:     { color: 'rgba(0,0,0,0.04)' },
            border:   { display: false, dash: [4, 4] },
            ticks:    {
              font:  { size: 11 }, color: '#9ca3af',
              callback: (v) => `${Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`,
            },
          },
          yOrders: {
            type:          'linear',
            position:      'right',
            grid:          { drawOnChartArea: false },
            border:        { display: false },
            ticks:         { font: { size: 11 }, color: '#9ca3af', stepSize: 1 },
          },
        },
      },
    });

    // Store gradient for reuse
    (this.chart as unknown as { _gradient: CanvasGradient })._gradient = gradient;
  }

  private renderChart(points: RevenueSeries[]): void {
    if (!this.chart) return;

    const gradient = (this.chart as unknown as { _gradient: CanvasGradient })._gradient;

    this.chart.data.labels = points.map(d =>
      new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    );

    this.chart.data.datasets = [
      {
        label:           'Revenue',
        data:            points.map(d => d.total_revenue),
        borderColor:     '#2563eb',
        backgroundColor: gradient ?? 'rgba(37,99,235,0.1)',
        borderWidth:     2.5,
        pointRadius:     points.length > 30 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#2563eb',
        fill:            true,
        tension:         0.4,
        yAxisID:         'yRevenue',
      },
      {
        label:           'Orders',
        data:            points.map(d => d.order_count),
        borderColor:     '#16a34a',
        backgroundColor: 'transparent',
        borderWidth:     2,
        pointRadius:     points.length > 30 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#16a34a',
        fill:            false,
        tension:         0.4,
        borderDash:      [5, 3],
        yAxisID:         'yOrders',
      },
    ];

    this.chart.update('active');
  }
}
