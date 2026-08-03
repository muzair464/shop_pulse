import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * API_URL is injected at build time by esbuild's --define flag via build.mjs.
 * It is replaced with the literal string value of the API_URL environment
 * variable during `npm run build` (production) or defaults to localhost:3000
 * for `npm run build:dev`.
 *
 * For local `ng serve`, the TypeScript declaration below provides the fallback
 * so the code compiles — the actual value is overridden at build time.
 *
 * Never import from environments/ — that folder no longer exists.
 */
declare const API_URL: string;

/**
 * ApiClient — thin wrapper over Angular HttpClient for the Node.js Express backend.
 *
 *  - withCredentials: true on every request so the httpOnly session cookie
 *    is sent automatically — Angular never reads or stores a token.
 *  - No Authorization header — the backend reads the cookie directly.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  /**
   * Base URL resolved at runtime from the build-time injected API_URL constant.
   * Falls back to localhost:3000 when running via `ng serve` (no define applied).
   */
  private readonly base: string = (() => {
    try {
      // API_URL is replaced by esbuild define — this branch is taken in all builds.
      return API_URL;
    } catch {
      // Fallback for `ng serve` where define has not been applied.
      return 'http://localhost:3000';
    }
  })();

  private get defaultHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  async get<T>(path: string): Promise<T> {
    try {
      return await firstValueFrom(
        this.http.get<T>(`${this.base}${path}`, {
          headers: this.defaultHeaders,
          withCredentials: true,
        }),
      );
    } catch (err) {
      throw ApiError.from(err);
    }
  }

  async post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    const headers = idempotencyKey
      ? this.defaultHeaders.set('X-Idempotency-Key', idempotencyKey)
      : this.defaultHeaders;
    try {
      return await firstValueFrom(
        this.http.post<T>(`${this.base}${path}`, body, {
          headers,
          withCredentials: true,
        }),
      );
    } catch (err) {
      throw ApiError.from(err);
    }
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    try {
      return await firstValueFrom(
        this.http.patch<T>(`${this.base}${path}`, body, {
          headers: this.defaultHeaders,
          withCredentials: true,
        }),
      );
    } catch (err) {
      throw ApiError.from(err);
    }
  }

  async delete(path: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.base}${path}`, {
          headers: this.defaultHeaders,
          withCredentials: true,
        }),
      );
    } catch (err) {
      throw ApiError.from(err);
    }
  }

  /**
   * Triggers a file download by fetching the endpoint and creating a
   * temporary <a> element. Used for CSV/JSON export buttons.
   */
  async download(path: string, filename?: string): Promise<void> {
    try {
      const blob = await firstValueFrom(
        this.http.get(`${this.base}${path}`, {
          responseType: 'blob',
          withCredentials: true,
        }),
      );
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename ?? `export-${Date.now()}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      throw ApiError.from(err);
    }
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isConflict(): boolean     { return this.status === 409; }
  get isUnauthorized(): boolean { return this.status === 401; }
  get isNotFound(): boolean     { return this.status === 404; }

  static from(err: unknown): ApiError {
    if (err instanceof ApiError) return err;
    if (err instanceof HttpErrorResponse) {
      const msg: string =
        (err.error as { detail?: string; error?: string } | null)?.detail
        ?? (err.error as { detail?: string; error?: string } | null)?.error
        ?? err.message
        ?? 'Unknown error';
      return new ApiError(err.status, msg);
    }
    return new ApiError(0, String(err));
  }
}
