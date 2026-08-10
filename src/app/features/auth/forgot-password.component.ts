import {
  Component, inject, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Zap, Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-angular';
import { AuthService } from '../../core/auth.service';

/**
 * ForgotPasswordComponent — /forgot-password
 *
 * Standalone page reached when the user clicks "Forgot password?" on the
 * sign-in screen. Collects the email address, calls POST
 * /api/v1/auth/forgot-password, and shows a confirmation screen.
 *
 * The reset email's link points to /set-password?token_hash=XXX&type=recovery,
 * which is handled by SetPasswordComponent — no extra work needed there.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="w-full max-w-sm">

      <!-- Brand header -->
      <div class="mb-8 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl
                    bg-primary-600 mb-4 shadow-lg">
          <lucide-icon [img]="ZapIcon" size="24" class="text-white" aria-hidden="true" />
        </div>
        <h1 class="text-2xl font-bold text-gray-900">ShopPulse</h1>
        <p class="mt-1 text-sm text-gray-500">Reset your password</p>
      </div>

      <!-- ── Email sent confirmation ──────────────────────────────────── -->
      @if (emailSent()) {
        <div class="card p-8 text-center space-y-5">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full
                      bg-green-50 mx-auto">
            <lucide-icon [img]="CheckCircleIcon" size="32"
              class="text-green-500" aria-hidden="true" />
          </div>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-gray-900">Check your inbox</h2>
            <p class="text-sm text-gray-500">We sent a password reset link to</p>
            <p class="text-sm font-semibold text-gray-800 break-all">{{ sentTo() }}</p>
          </div>
          <p class="text-xs text-gray-400 leading-relaxed">
            Click the link in the email to choose a new password.
            The link expires in&nbsp;1&nbsp;hour.
          </p>
          <a routerLink="/signin"
            class="inline-flex items-center justify-center gap-1.5 w-full btn-secondary text-sm">
            <lucide-icon [img]="ArrowLeftIcon" size="14" aria-hidden="true" />
            Back to sign in
          </a>
        </div>
      }

      <!-- ── Request form ──────────────────────────────────────────────── -->
      @if (!emailSent()) {
        @if (errorMessage()) {
          <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3
                      text-sm text-red-700" role="alert" aria-live="polite">
            {{ errorMessage() }}
          </div>
        }

        <div class="card p-8">
          <p class="text-sm text-gray-500 mb-5">
            Enter the email address linked to your account and we'll send you a
            reset link.
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="space-y-4">
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <div class="relative">
                <lucide-icon [img]="MailIcon" size="15"
                  class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  aria-hidden="true" />
                <input id="email" type="email" formControlName="email"
                  autocomplete="email"
                  class="form-input pl-9"
                  [class.border-red-400]="emailInvalid"
                  placeholder="you@example.com"
                  aria-required="true"
                  [attr.aria-invalid]="emailInvalid"
                  aria-describedby="email-error" />
              </div>
              @if (emailInvalid) {
                <p id="email-error" class="mt-1 text-xs text-red-600" role="alert">
                  Please enter a valid email address.
                </p>
              }
            </div>

            <button type="submit" class="btn-primary w-full justify-center"
              [disabled]="loading()" [attr.aria-busy]="loading()">
              @if (loading()) {
                <lucide-icon [img]="Loader2Icon" size="16"
                  class="animate-spin" aria-hidden="true" />
                Sending…
              } @else {
                Send reset link
              }
            </button>
          </form>
        </div>

        <div class="mt-5 text-center">
          <a routerLink="/signin"
            class="inline-flex items-center gap-1.5 text-sm text-gray-500
                   hover:text-gray-700 hover:underline focus:outline-none focus:underline">
            <lucide-icon [img]="ArrowLeftIcon" size="14" aria-hidden="true" />
            Back to sign in
          </a>
        </div>
      }

    </div>
  `,
})
export class ForgotPasswordComponent {
  private readonly fb   = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly ZapIcon          = Zap;
  readonly Loader2Icon      = Loader2;
  readonly MailIcon         = Mail;
  readonly ArrowLeftIcon    = ArrowLeft;
  readonly CheckCircleIcon  = CheckCircle;

  readonly loading      = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly emailSent    = signal(false);
  readonly sentTo       = signal<string>('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  get emailInvalid(): boolean {
    const c = this.form.controls.email;
    return c.invalid && c.touched;
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email } = this.form.getRawValue();
    const { error } = await this.auth.resetPassword(email);

    this.loading.set(false);

    if (error) {
      this.errorMessage.set(error);
    } else {
      this.sentTo.set(email);
      this.emailSent.set(true);
    }
  }
}
