/**
 * local-db.service.ts — intentionally empty shim.
 *
 * IndexedDB (Dexie) has been removed from this project. All data is fetched
 * directly from the server on every load. This file exists only to satisfy
 * any residual import that has not yet been cleaned up; it contains no
 * actual implementation and opens no database.
 */
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LocalDbService {}
