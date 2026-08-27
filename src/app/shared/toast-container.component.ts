import {
  Component, inject, ChangeDetectionStrategy,
} from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { LucideAngularModule, X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-angular';
import { ToastService, Toast, ToastType } from '../core/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  animations: [
    trigger('toastAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px) scale(0.96)' }),
        animate('200ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
      ]),
      transition(':leave', [
        animate('150ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 0, transform: 'translateY(6px) scale(0.97)' })),
      ]),
    ]),
  ],
  template: `
    <div
      aria-live="polite"
      aria-atomic="true"
      class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          @toastAnim
          role="alert"
          class="flex items-start gap-3 rounded-xl border px-4 py-3 shadow-float bg-white"
          [class]="borderClass(toast.type)"
        >
          <lucide-icon
            [img]="iconFor(toast.type)"
            size="16"
            [class]="iconClass(toast.type)"
            class="shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p class="flex-1 text-sm text-ink leading-snug">{{ toast.message }}</p>
          <button
            type="button"
            (click)="toastService.dismiss(toast.id)"
            class="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors duration-150 ease-sp rounded"
            [attr.aria-label]="'Dismiss: ' + toast.message"
          >
            <lucide-icon [img]="XIcon" size="14" aria-hidden="true" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  readonly XIcon = X;

  iconFor(type: ToastType) {
    return { success: CheckCircle, error: AlertCircle, info: Info, warning: AlertTriangle }[type];
  }

  iconClass(type: ToastType): string {
    return {
      success: 'text-success-600',
      error:   'text-danger-600',
      info:    'text-primary-500',
      warning: 'text-warning-600',
    }[type];
  }

  borderClass(type: ToastType): string {
    return {
      success: 'border-success-100',
      error:   'border-danger-100',
      info:    'border-primary-100',
      warning: 'border-warning-100',
    }[type];
  }
}
