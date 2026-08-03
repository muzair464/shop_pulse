import {
  Component, input, output, ChangeDetectionStrategy,
} from '@angular/core';

export interface TableColumn<T> {
  key: string;
  label: string;
  /** Optional cell value formatter */
  format?: (row: T) => string;
  /** Optional CSS classes for the <td> */
  tdClass?: string;
  /** Whether this column allows custom cell template (handled via named slot externally) */
  custom?: boolean;
}

/**
 * DataTableComponent — generic, reusable table.
 *
 * Supports:
 *  - Column definition via `columns` input
 *  - Row click output
 *  - Loading / empty states
 *  - Content projection for custom cell rendering (via a wrapper component)
 *
 * Used by: InventoryComponent, OrdersComponent.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200" role="grid">
          <thead class="bg-gray-50">
            <tr>
              @for (col of columns(); track col.key) {
                <th
                  scope="col"
                  class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  {{ col.label }}
                </th>
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            @if (loading()) {
              @for (i of skeletonRows; track i) {
                <tr class="animate-pulse">
                  @for (col of columns(); track col.key) {
                    <td class="px-4 py-3">
                      <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                    </td>
                  }
                </tr>
              }
            } @else if (rows().length === 0) {
              <tr>
                <td
                  [attr.colspan]="columns().length"
                  class="px-4 py-12 text-center text-sm text-gray-400"
                >
                  {{ emptyMessage() }}
                </td>
              </tr>
            } @else {
              <!-- Row content is projected from the parent via ng-content.
                   The parent iterates rows and places cells inside. -->
              <ng-content />
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class DataTableComponent<T = unknown> {
  readonly columns = input.required<TableColumn<T>[]>();
  readonly rows = input<T[]>([]);
  readonly loading = input<boolean>(false);
  readonly emptyMessage = input<string>('No records found.');
  readonly rowClick = output<T>();

  readonly skeletonRows = [1, 2, 3, 4, 5];
}
