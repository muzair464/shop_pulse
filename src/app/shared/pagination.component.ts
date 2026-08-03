import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { LucideAngularModule, ChevronLeft, ChevronRight } from 'lucide-angular';

@Component({
  selector: 'app-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    @if (totalPages() > 1) {
      <div class="flex items-center justify-between px-1 py-3">
        <p class="text-sm text-gray-500">
          Showing
          <span class="font-medium text-gray-700">{{ rangeStart() }}–{{ rangeEnd() }}</span>
          of
          <span class="font-medium text-gray-700">{{ totalItems() }}</span>
        </p>

        <div class="flex items-center gap-1">
          <button
            type="button"
            (click)="prev()"
            [disabled]="currentPage() === 0"
            class="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5
                   text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40
                   disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <lucide-icon [img]="ChevronLeftIcon" size="16" aria-hidden="true" />
          </button>

          <!-- Page number buttons (show up to 5 around current) -->
          @for (page of visiblePages(); track page) {
            @if (page === -1) {
              <span class="px-1 text-gray-400 text-sm">…</span>
            } @else {
              <button
                type="button"
                (click)="goTo(page)"
                [class.bg-primary-600]="page === currentPage()"
                [class.text-white]="page === currentPage()"
                [class.border-primary-600]="page === currentPage()"
                class="inline-flex items-center justify-center w-8 h-8 rounded-lg border
                       border-gray-200 bg-white text-sm text-gray-600
                       hover:bg-gray-50 transition-colors"
                [attr.aria-label]="'Page ' + (page + 1)"
                [attr.aria-current]="page === currentPage() ? 'page' : null"
              >
                {{ page + 1 }}
              </button>
            }
          }

          <button
            type="button"
            (click)="next()"
            [disabled]="currentPage() === totalPages() - 1"
            class="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5
                   text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40
                   disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <lucide-icon [img]="ChevronRightIcon" size="16" aria-hidden="true" />
          </button>
        </div>
      </div>
    }
  `,
})
export class PaginationComponent {
  readonly totalItems = input.required<number>();
  readonly pageSize = input<number>(20);
  readonly currentPage = input<number>(0);
  readonly pageChange = output<number>();

  readonly ChevronLeftIcon = ChevronLeft;
  readonly ChevronRightIcon = ChevronRight;

  readonly totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize()));
  readonly rangeStart = computed(() => this.currentPage() * this.pageSize() + 1);
  readonly rangeEnd = computed(() =>
    Math.min((this.currentPage() + 1) * this.pageSize(), this.totalItems()),
  );

  readonly visiblePages = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);

    const pages: number[] = [0];
    if (current > 2) pages.push(-1);
    for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 3) pages.push(-1);
    pages.push(total - 1);
    return pages;
  });

  prev(): void {
    if (this.currentPage() > 0) this.pageChange.emit(this.currentPage() - 1);
  }

  next(): void {
    if (this.currentPage() < this.totalPages() - 1) this.pageChange.emit(this.currentPage() + 1);
  }

  goTo(page: number): void {
    if (page !== this.currentPage()) this.pageChange.emit(page);
  }
}
