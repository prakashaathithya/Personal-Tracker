import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from './api.service';
import { AppNotification, NotificationType } from './models';

const ICONS: Record<NotificationType, string> = {
  card_bill_generated: 'receipt_long',
  card_bill_due_soon: 'schedule',
  card_bill_overdue: 'warning',
  card_limit_warning: 'speed',
};

/**
 * The bell's shared state. Also drives the catch-up run on app load, which
 * is what generates a credit card bill once its statement date has passed.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly items = signal<AppNotification[]>([]);
  readonly unread = signal(0);
  readonly hasUnread = computed(() => this.unread() > 0);

  icon(type: NotificationType): string {
    return ICONS[type] ?? 'notifications';
  }

  refresh(): void {
    this.api.listNotifications().subscribe({
      next: (r) => {
        this.items.set(r.data);
        this.unread.set(r.unread);
      },
      error: () => undefined,
    });
  }

  /**
   * Generates any bills that came due while you were away, then surfaces
   * whatever that raised as a toast. Errors stay quiet — a failed catch-up
   * shouldn't block the app from loading.
   */
  bootstrap(): void {
    this.api.runCreditCards().subscribe({
      next: (r) => {
        this.refresh();
        if (r.notifications > 0) this.toast(r.notifications);
      },
      error: () => this.refresh(),
    });
  }

  private toast(count: number): void {
    this.api.listNotifications(count).subscribe({
      next: (r) => {
        const fresh = r.data.filter((n) => !n.read_at);
        if (!fresh.length) return;
        const message =
          fresh.length === 1
            ? fresh[0].title
            : `${fresh.length} new alerts — ${fresh[0].title}`;
        this.snack
          .open(message, 'View', { duration: 8000 })
          .onAction()
          .subscribe(() => {
            void this.router.navigateByUrl(fresh[0].link ?? '/credit-cards');
          });
      },
      error: () => undefined,
    });
  }

  markRead(n: AppNotification): void {
    if (n.read_at) return;
    this.api.markNotificationRead(n.id).subscribe({
      next: () => {
        this.items.update((list) =>
          list.map((x) =>
            x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
          ),
        );
        this.unread.update((c) => Math.max(0, c - 1));
      },
      error: () => undefined,
    });
  }

  markAllRead(): void {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        const now = new Date().toISOString();
        this.items.update((list) =>
          list.map((x) => (x.read_at ? x : { ...x, read_at: now })),
        );
        this.unread.set(0);
      },
      error: () => undefined,
    });
  }

  dismiss(n: AppNotification): void {
    this.api.deleteNotification(n.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((x) => x.id !== n.id));
        if (!n.read_at) this.unread.update((c) => Math.max(0, c - 1));
      },
      error: () => undefined,
    });
  }
}
