import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { from } from 'rxjs';
import { routes } from './app.routes';
import { AuthService } from './core/auth.service';

/**
 * 401 interceptor — on an Unauthorized response, attempt a silent token
 * refresh via POST /api/v1/auth/refresh, then retry the original request once.
 * If the refresh fails, sign the user out.
 */
const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  // Skip refresh and sign-out endpoints to avoid infinite loops
  const isAuthPath = req.url.includes('/api/v1/auth/');
  return next(req).pipe(
    catchError((err: unknown) => {
      if (
        !isAuthPath
        && err instanceof HttpErrorResponse
        && err.status === 401
      ) {
        const auth = inject(AuthService);
        return from(auth.refreshToken()).pipe(
          switchMap((refreshed) => {
            if (refreshed) {
              // Retry the original request — cookie has been updated
              return next(req.clone());
            }
            void auth.signOut();
            return throwError(() => err);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    ),
    provideAnimations(),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor]),
    ),
  ],
};
