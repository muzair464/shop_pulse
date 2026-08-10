import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { LucideAngularModule, TrendingUp, TrendingDown, Minus } from 'lucide-angular';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LucideIconData = any;

@Component({
  selector: 'app-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
      <!-- Top row: icon + trend badge -->
      <div class="flex items-start justify-between">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          [class]="iconBgClass()"
        >
          <lucide-icon [img]="icon()" size="18" [class]="iconColorClass()" aria-hidden="true" />
        </div>

        <!-- Trend badge — only shown when trend() is provided -->
        @if (trend() !== null) {
          <span
            class="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full"
            [class]="trendClasses()"
            [attr.aria-label]="trendAriaLabel()"
          >
            <lucide-icon [img]="trendIcon()" size="11" aria-hidden="true" />
            {{ trendText() }}
          </span>
        }
      </div>

      <!-- Value + label -->
      <div class="min-w-0">
        <p class="text-2xl font-bold text-gray-900 tabular-nums leading-tight truncate">
          {{ value() }}
        </p>
        <p class="mt-0.5 text-sm font-medium text-gray-500 truncate">{{ label() }}</p>
        @if (subtext()) {
          <p class="mt-1 text-xs text-gray-400 truncate">{{ subtext() }}</p>
        }
      </div>
    </div>
  `,
})
export class StatCardComponent {
  readonly label         = input.required<string>();
  readonly value         = input.required<string | number>();
  readonly icon          = input.required<LucideIconData>();
  readonly subtext       = input<string>('');
  readonly iconBgClass   = input<string>('bg-blue-100');
  readonly iconColorClass = input<string>('text-blue-600');
  /**
   * Percentage change vs the comparison period.
   * Positive = up, negative = down, 0 = flat, null = no badge.
   */
  readonly trend = input<number | null>(null);

  readonly TrendingUpIcon   = TrendingUp;
  readonly TrendingDownIcon = TrendingDown;
  readonly MinusIcon        = Minus;

  readonly trendIcon = computed(() => {
    const t = this.trend();
    if (t === null || t === 0) return this.MinusIcon;
    return t > 0 ? this.TrendingUpIcon : this.TrendingDownIcon;
  });

  readonly trendText = computed(() => {
    const t = this.trend();
    if (t === null) return '';
    if (t === 0)    return 'flat';
    return `${t > 0 ? '+' : ''}${t.toFixed(1)}%`;
  });

  readonly trendClasses = computed(() => {
    const t = this.trend();
    if (t === null || t === 0) return 'bg-gray-100 text-gray-500';
    return t > 0
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-600';
  });

  readonly trendAriaLabel = computed(() => {
    const t = this.trend();
    if (t === null) return '';
    if (t === 0)    return 'No change vs yesterday';
    return `${t > 0 ? 'Up' : 'Down'} ${Math.abs(t).toFixed(1)}% vs yesterday`;
  });
}
