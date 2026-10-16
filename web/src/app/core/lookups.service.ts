import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Account, Category, PaymentType } from './models';

/** How long a cached list is served before the next read refetches it. */
const TTL_MS = 5 * 60 * 1000;

type LookupName = 'categories' | 'paymentTypes' | 'accounts';

interface Entry<T> {
  value$: Observable<T>;
  fetchedAt: number;
}

/**
 * Cache for the lists every screen needs but almost nobody changes —
 * categories, payment types and accounts. Each was refetched on every
 * navigation, so opening four pages meant a dozen identical requests.
 *
 * Reads share one in-flight request and then reuse the result for `TTL_MS`.
 * Anything that edits one of these lists must call `invalidate` so the next
 * read goes back to the API; the TTL is only a backstop for edits made
 * somewhere else (another tab or device).
 */
@Injectable({ providedIn: 'root' })
export class LookupsService {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<LookupName, Entry<unknown>>();

  categories(): Observable<Category[]> {
    return this.read('categories', () => this.api.listCategories());
  }

  paymentTypes(): Observable<PaymentType[]> {
    return this.read('paymentTypes', () => this.api.listPaymentTypes());
  }

  accounts(): Observable<Account[]> {
    return this.read('accounts', () => this.api.listAccounts());
  }

  /** Drops one cached list (or all of them) so the next read refetches. */
  invalidate(...names: LookupName[]): void {
    if (!names.length) this.cache.clear();
    for (const name of names) this.cache.delete(name);
  }

  private read<T>(name: LookupName, fetch: () => Observable<T>): Observable<T> {
    const hit = this.cache.get(name);
    if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
      return hit.value$ as Observable<T>;
    }

    // refCount stays false so the value survives a component unsubscribing
    // on navigation — that is the whole point of caching it. A failure is
    // evicted immediately, or shareReplay would hand the same error to every
    // later reader instead of retrying.
    const value$ = fetch().pipe(
      tap({ error: () => this.cache.delete(name) }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.cache.set(name, { value$, fetchedAt: Date.now() });
    return value$;
  }
}
