import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { LucideAngularModule, Eye, EyeOff, Zap, Loader2, CheckCircle, AlertCircle } from 'lucide-angular';
import { AuthService } from '../../core/auth.service';

type FlowType = 'invite' | 'recovery' | 'email';
type PageState = 'exchanging' | 'ready' | 'saving' | 'done' | 'error';

/** Reactive-form cross-field validator — passwords must match. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pw  = group.get('newPassword')?.value as string;
  const cpw = group.get('confirmPassword')?.value as string;
  return pw && cpw && pw !== cpw ? { mismatch: true } : null;
}

/**
 * SetPasswordComponent — /set-password
 *
 * Handles two flows that both land on this page via a Supabase email link:
 *
 *  INVITE   — Owner was created in Supabase Dashboard ("Invite user").
 *             Link: https://app.shoppulse.app/set-password?token_hash=XXX&type=invite
 *             User must set their password before they can use the app.
 *
 *  RECOVERY — Owner clicked "Forgot password?" and requested a reset.
 *             Link: https://app.shoppulse.app/set-password?token_hash=XXX&type=recovery
 *             User sets a new password to regain access.
 *
 * Flow:
 *  1. On mount, read token_hash + type from the URL query params.
 *  2. POST /api/v1/auth/exchange-token — backend verifies the OTP and sets
 *     httpOnly session cookies, giving us a real authenticated session.
 *  3. Show the "Set your password" form.
 *  4. PATCH /api/v1/auth/set-password — saves the new password.
 *  5. Redirect to /dashboard.
 *
 * If token_hash or type is missing/invalid the user is redirected to /signin.
 */
@Component({
  selector: 'app-set-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LucideAngularModule],
  template: `
    <div class="w-full max-w-sm">

      <!-- Brand header -->
      <div class="mb-8 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl
                    bg-primary-600 mb-4 shadow-lg">
          <lucide-icon [img]="ZapIcon" size="24" class="text-white" aria-hidden="true" />
        </div>
        <h1 class="text-2xl font-bold text-gray-900">ShopPulse</h1>
        <p class="mt-1 text-sm text-gray-500">{{ pageTitle() }}</p>
      </div>

      <!-- ── Exchanging token (spinner) ───────────────────────────────── -->
      @if (state() === 'exchanging') {
        <div class="card p-10 flex flex-col items-center gap-3">
          <lucide-icon [img]="Loader2Icon" size="28"
            class="text-primary-500 animate-spin" aria-hidden="true" />
          <p class="text-sm text-gray-500">Verifying your link…</p>
        </div>
      }

      <!-- ── Token exchange failed ────────────────────────────────────── -->
      @if (state() === 'error') {
        <div class="card p-8 text-center space-y-4">
          <lucide-icon [img]="AlertCircleIcon" size="36"
            class="mx-auto text-red-400" aria-hidden="true" />
          <div>
            <p class="text-sm font-semibold text-gray-800">Link invalid or expired</p>
            <p class="mt-1 text-xs text-gray-500">{{ errorMessage() }}</p>
          </div>
          <button type="button" (click)="goToSignIn()"
            class="btn-primary w-full justify-center">
            Back to Sign In
          </button>
        </div>
      }

      <!-- ── Set password form ────────────────────────────────────────── -->
      @if (state() === 'ready' || state() === 'saving') {
        <div class="card p-8">
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="space-y-4">

            <div>
              <label for="new-password" class="block text-sm font-medium text-gray-700 mb-1.5">
                New password
                <span class="text-red-500 ml-0.5" aria-hidden="true">*</span>
              </label>
              <div class="relative">
                <input
                  id="new-password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="newPassword"
                  autocomplete="new-password"
                  class="form-input pr-10"
                  [class.border-red-400]="newPasswordInvalid"
                  placeholder="At least 8 characters"
                  aria-required="true"
                  [attr.aria-invalid]="newPasswordInvalid"
                  aria-describedby="new-password-error"
                />
                <button type="button" (click)="togglePassword()"
                  class="absolute inset-y-0 right-0 flex items-center pr-3
                         text-gray-400 hover:text-gray-600"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                  <lucide-icon [img]="showPassword() ? EyeOffIcon : EyeIcon"
                    size="16" aria-hidden="true" />
                </button>
              </div>
              @if (newPasswordInvalid) {
                <p id="new-password-error" class="mt-1 text-xs text-red-600" role="alert">
                  Password must be at least 8 characters.
                </p>
              }
            </div>

            <div>
              <label for="confirm-password" class="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm password
                <span class="text-red-500 ml-0.5" aria-hidden="true">*</span>
              </label>
              <input
                id="confirm-password"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="confirmPassword"
                autocomplete="new-password"
                class="form-input"
                [class.border-red-400]="confirmPasswordInvalid"
                placeholder="Repeat your password"
                aria-required="true"
                [attr.aria-invalid]="confirmPasswordInvalid"
                aria-describedby="confirm-password-error"
              />
              @if (confirmPasswordInvalid) {
                <p id="confirm-password-error" class="mt-1 text-xs text-red-600" role="alert">
                  Passwords do not match.
                </p>
              }
            </div>

            @if (formError()) {
              <p class="text-sm text-red-600" role="alert">{{ formError() }}</p>
            }

            <!-- Strength hint -->
            <div class="flex gap-1.5" aria-label="Password strength">
              @for (segment of strengthSegments(); track $index) {
                <div
                  class="flex-1 h-1 rounded-full transition-colors"
                  [class]="segment"
                ></div>
              }
            </div>

            <button type="submit"
              class="btn-primary w-full justify-center"
              [disabled]="state() === 'saving'"
              [attr.aria-busy]="state() === 'saving'">
              @if (state() === 'saving') {
                <lucide-icon [img]="Loader2Icon" size="16"
                  class="animate-spin" aria-hidden="true" />
                Setting password…
              } @else {
                Set Password & Continue
              }
            </button>

          </form>
        </div>
      }

      <!-- ── Success ───────────────────────────────────────────────────── -->
      @if (state() === 'done') {
        <div class="card p-10 flex flex-col items-center gap-3 text-center">
          <lucide-icon [img]="CheckCircleIcon" size="36"
            class="text-green-500" aria-hidden="true" />
          <p class="text-sm font-semibold text-gray-800">Password set successfully!</p>
          <p class="text-xs text-gray-500">Redirecting you to the dashboard…</p>
        </div>
      }

    </div>
  `,
})
export class SetPasswordComponent implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);
  private readonly fb     = inject(FormBuilder);

  readonly ZapIcon          = Zap;
  readonly EyeIcon          = Eye;
  readonly EyeOffIcon       = EyeOff;
  readonly Loader2Icon      = Loader2;
  readonly CheckCircleIcon  = CheckCircle;
  readonly AlertCircleIcon  = AlertCircle;

  readonly state        = signal<PageState>('exchanging');
  readonly errorMessage = signal<string | null>(null);
  readonly formError    = signal<string | null>(null);
  readonly showPassword = signal(false);

  private flowType: FlowType = 'invite';

  readonly form = this.fb.nonNullable.group(
    {
      newPassword:     ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  // ── Computed helpers ──────────────────────────────────────────────────────

  readonly pageTitle = computed(() => {
    if (this.state() === 'done') return 'All set!';
    return this.flowType === 'invite'
      ? 'Set your password to get started'
      : 'Reset your password';
  });

  get newPasswordInvalid(): boolean {
    const c = this.form.controls.newPassword;
    return c.invalid && c.touched;
  }

  get confirmPasswordInvalid(): boolean {
    return this.form.touched
      && !!this.form.errors?.['mismatch']
      && !!this.form.controls.confirmPassword.value;
  }

  /** 4-segment colour bar indicating password strength. */
  readonly strengthSegments = computed(() => {
    const pw  = this.form.controls.newPassword.value as string;
    const len = pw.length;
    const hasUpper   = /[A-Z]/.test(pw);
    const hasDigit   = /\d/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    const score = (len >= 8 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasDigit ? 1 : 0) + (hasSpecial ? 1 : 0);
    const colours = ['bg-gray-200', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];
    return [0, 1, 2, 3].map(i => i < score ? colours[score] : 'bg-gray-200');
  });

  togglePassword(): void { this.showPassword.update(v => !v); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    const params    = this.route.snapshot.queryParamMap;
    const tokenHash = params.get('token_hash');
    const type      = params.get('type') as FlowType | null;

    // Missing params — this page was reached without a valid link.
    if (!tokenHash || !type || !['invite', 'recovery', 'email'].includes(type)) {
      void this.router.navigate(['/signin'], { replaceUrl: true });
      return;
    }

    this.flowType = type;

    // Exchange the OTP for a real session cookie.
    const { error } = await this.auth.exchangeToken(tokenHash, type);

    if (error) {
      this.errorMessage.set(error);
      this.state.set('error');
      return;
    }

    this.state.set('ready');
  }

  // ── Form submit ───────────────────────────────────────────────────────────

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.state.set('saving');
    this.formError.set(null);

    const { newPassword } = this.form.getRawValue();
    const { error } = await this.auth.setPassword(newPassword);

    if (error) {
      this.formError.set(error);
      this.state.set('ready');
      return;
    }

    this.state.set('done');

    // After recovery, redirect to sign-in so the user logs in with their new password.
    // After invite acceptance, go straight to dashboard (session is already established).
    setTimeout(() => {
      if (this.flowType === 'recovery') {
        void this.router.navigate(['/signin'], { replaceUrl: true });
      } else {
        void this.router.navigate(['/dashboard'], { replaceUrl: true });
      }
    }, 1_500);
  }

  goToSignIn(): void {
    void this.router.navigate(['/signin'], { replaceUrl: true });
  }
}
