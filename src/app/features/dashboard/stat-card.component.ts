import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

// Icon data type — lucide-angular exports icons as [tag, attrs, children][] tuples at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LucideIconData = any;

@Component({
  selector: 'app-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="card p-5 flex items-start gap-4">
      <div
        class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
        [class]="iconBgClass()"
      >
        <lucide-icon [img]="icon()" size="20" [class]="iconColorClass()" aria-hidden="true" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-gray-500 truncate">{{ label() }}</p>
        <p class="mt-0.5 text-2xl font-bold text-gray-900 tabular-nums">{{ value() }}</p>
        @if (subtext()) {
          <p class="mt-1 text-xs text-gray-400">{{ subtext() }}</p>
        }
      </div>
    </div>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input.required<LucideIconData>();
  readonly subtext = input<string>('');
  readonly iconBgClass = input<string>('bg-blue-100');
  readonly iconColorClass = input<string>('text-blue-600');
}
