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
        style({ opacity: 0, transform: 'translateY(16px) scale(0.97)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(8px) scale(0.97)' })),
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
          class="flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg bg-white"
          [class]="borderClass(toast.type)"
        >
          <lucide-icon
            [img]="iconFor(toast.type)"
            size="18"
            [class]="iconClass(toast.type)"
            aria-hidden="true"
          />
          <p class="flex-1 text-sm text-gray-700 leading-snug">{{ toast.message }}</p>
          <button
            type="button"
            (click)="toastService.dismiss(toast.id)"
            class="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            [attr.aria-label]="'Dismiss notification: ' + toast.message"
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
      success: 'text-green-500',
      error: 'text-red-500',
      info: 'text-blue-500',
      warning: 'text-yellow-500',
    }[type];
  }

  borderClass(type: ToastType): string {
    return {
      success: 'border-green-200',
      error: 'border-red-200',
      info: 'border-blue-200',
      warning: 'border-yellow-200',
    }[type];
  }
}
