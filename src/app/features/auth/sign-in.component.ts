import {
  Component, inject, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule, Eye, EyeOff, Zap, Loader2 } from 'lucide-angular';
import { AuthService } from '../../core/auth.service';
@Component({
  selector: 'app-sign-in',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="w-full max-w-sm">

      <div class="mb-8 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl
                    bg-primary-600 mb-4 shadow-lg">
          <lucide-icon [img]="ZapIcon" size="24" class="text-white" aria-hidden="true" />
        </div>
        <h1 class="text-2xl font-bold text-gray-900">ShopPulse</h1>
        <p class="mt-1 text-sm text-gray-500">Sign in to your account</p>
      </div>

      @if (errorMessage()) {
        <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3
                    text-sm text-red-700" role="alert" aria-live="polite">
          {{ errorMessage() }}
        </div>
      }

      <div class="card p-8">
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>

          <div class="mb-4">
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              id="email" type="email" formControlName="email"
              autocomplete="email" class="form-input"
              [class.border-red-400]="emailInvalid"
              placeholder="you@example.com"
              aria-required="true" [attr.aria-invalid]="emailInvalid"
              aria-describedby="email-error"
            />
            @if (emailInvalid) {
              <p id="email-error" class="mt-1 text-xs text-red-600" role="alert">
                Please enter a valid email address.
              </p>
            }
          </div>

          <div class="mb-4">
            <div class="flex items-center justify-between mb-1.5">
              <label for="password" class="block text-sm font-medium text-gray-700">
                Password
              </label>
              <a routerLink="/forgot-password"
                class="text-xs text-primary-600 hover:text-primary-700 hover:underline focus:outline-none focus:underline">
                Forgot password?
              </a>
            </div>
            <div class="relative">
              <input
                id="password" [type]="showPassword() ? 'text' : 'password'"
                formControlName="password" autocomplete="current-password"
                class="form-input pr-10"
                [class.border-red-400]="passwordInvalid"
                placeholder="Enter your password"
                aria-required="true" [attr.aria-invalid]="passwordInvalid"
                aria-describedby="password-error"
              />
              <button type="button" (click)="togglePassword()"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                <lucide-icon [img]="showPassword() ? EyeOffIcon : EyeIcon" size="16" aria-hidden="true" />
              </button>
            </div>
            @if (passwordInvalid) {
              <p id="password-error" class="mt-1 text-xs text-red-600" role="alert">
                Password is required.
              </p>
            }
          </div>

          <div class="mb-6 flex items-center gap-2.5">
            <input id="rememberDevice" type="checkbox" formControlName="rememberDevice"
              class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
            <label for="rememberDevice" class="text-sm text-gray-600 cursor-pointer select-none">
              Remember this device
            </label>
          </div>

          <button type="submit" class="btn-primary w-full justify-center"
            [disabled]="loading()" [attr.aria-busy]="loading()">
            @if (loading()) {
              <lucide-icon [img]="Loader2Icon" size="16" class="animate-spin" aria-hidden="true" />
              Signing in…
            } @else {
              Sign in
            }
          </button>

        </form>
      </div>

      <p class="mt-6 text-center text-sm text-gray-500">
        Don't have an account?
        <a routerLink="/signup"
          class="font-semibold text-primary-600 hover:text-primary-700 hover:underline
                 focus:outline-none focus:underline ml-1">
          Create one
        </a>
      </p>

    </div>
  `,
})
export class SignInComponent {
  private readonly fb     = inject(FormBuilder);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  readonly loading      = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  readonly ZapIcon     = Zap;
  readonly EyeIcon     = Eye;
  readonly EyeOffIcon  = EyeOff;
  readonly Loader2Icon = Loader2;

  readonly form = this.fb.nonNullable.group({
    email:          ['', [Validators.required, Validators.email]],
    password:       ['', [Validators.required, Validators.minLength(6)]],
    rememberDevice: [true],
  });

  get emailInvalid(): boolean {
    const c = this.form.controls.email;
    return c.invalid && c.touched;
  }

  get passwordInvalid(): boolean {
    const c = this.form.controls.password;
    return c.invalid && c.touched;
  }

  togglePassword(): void { this.showPassword.update(v => !v); }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password, rememberDevice } = this.form.getRawValue();
    const { error } = await this.auth.signIn({ email, password, rememberDevice });

    this.loading.set(false);

    if (error) { this.errorMessage.set(error); return; }

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
    void this.router.navigateByUrl(returnUrl, { replaceUrl: true });
  }
}
