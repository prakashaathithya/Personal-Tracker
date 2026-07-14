import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import {
  Account,
  Category,
  Direction,
  Frequency,
  RecurringTransaction,
} from '../../core/models';

@Component({
  selector: 'app-recurring',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Recurring</h1>
          <p class="page-subtitle">Templates that post automatically on schedule</p>
        </div>
        <span class="spacer"></span>
        <button class="action-btn ghost" (click)="runNow()" [disabled]="running()">
          <mat-icon>play_arrow</mat-icon> Run due now
        </button>
      </div>

      <mat-card class="add-card">
        <mat-card-content>
          <div class="card-title">Add a recurring item</div>
          <div class="add-grid">
            <input class="plain-input" placeholder="Description (e.g. Rent)" [(ngModel)]="f.description" />
            <div class="plain-input-wrap">
              <span class="prefix">₹</span>
              <input class="plain-input amt" type="number" placeholder="Amount" [(ngModel)]="f.amount" />
            </div>
            <select class="plain-input" [(ngModel)]="f.direction">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select class="plain-input" [(ngModel)]="f.frequency">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <label class="inline-field">
              <span>Every</span>
              <input class="plain-input tiny" type="number" min="1" [(ngModel)]="f.interval_count" />
            </label>
            <label class="inline-field">
              <span>Next</span>
              <input class="plain-input" type="date" [(ngModel)]="f.next_run" />
            </label>
            <select class="plain-input" [(ngModel)]="f.account_id">
              <option [ngValue]="null">Account…</option>
              @for (a of accounts(); track a.id) {
                <option [ngValue]="a.id">{{ a.name }}</option>
              }
            </select>
            <select class="plain-input" [(ngModel)]="f.category_id">
              <option [ngValue]="null">Category…</option>
              @for (c of categories(); track c.id) {
                <option [ngValue]="c.id">{{ c.name }}</option>
              }
            </select>
            <button class="action-btn" (click)="add()" [disabled]="!f.description || !f.amount || !f.next_run">
              <mat-icon>add</mat-icon> Add
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-content>
          <div class="card-title">Scheduled <span class="count">{{ items().length }}</span></div>
          @if (!items().length) {
            <p class="empty">Nothing scheduled yet.</p>
          }
          @for (r of items(); track r.id) {
            <div class="rec-row" [class.off]="!r.is_active">
              <div class="rec-main">
                <span class="rec-desc">{{ r.description }}</span>
                <span class="rec-meta">
                  {{ cadence(r) }} · next {{ r.next_run | date: 'dd MMM yyyy' }}
                  @if (r.account) { · {{ r.account.name }} }
                </span>
              </div>
              <span class="spacer"></span>
              <span class="rec-amt" [class.income]="r.direction === 'income'">
                {{ r.direction === 'income' ? '+' : '−' }}{{ r.amount | currency: 'INR' : 'symbol' : '1.0-0' }}
              </span>
              <mat-slide-toggle [checked]="r.is_active" (change)="toggle(r, $event.checked)" />
              <button matIconButton (click)="remove(r)"><mat-icon>delete</mat-icon></button>
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .page-subtitle { margin: 4px 0 0; font-size: 0.9rem; color: var(--mat-sys-on-surface-variant); }
      .card-title { font-weight: 700; font-size: 1.05rem; margin-bottom: 14px; }
      .card-title .count { font-size: 0.8rem; color: var(--mat-sys-on-surface-variant); margin-left: 6px; }
      .add-card { margin-bottom: 16px; }
      .add-grid { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .plain-input {
        height: 44px; padding: 0 12px; border-radius: 10px;
        border: 1px solid light-dark(#dbe7e1, #2c3a33);
        background: light-dark(#ffffff, #202a25); color: inherit;
        font-family: inherit; font-size: 0.92rem; box-sizing: border-box; outline: none;
      }
      .plain-input:focus { border-color: var(--mat-sys-primary); }
      .plain-input.tiny { width: 60px; }
      .plain-input-wrap { position: relative; display: flex; align-items: center; }
      .plain-input-wrap .prefix {
        position: absolute; left: 12px; color: var(--mat-sys-on-surface-variant); font-size: 0.9rem;
      }
      .plain-input.amt { padding-left: 26px; width: 130px; }
      .inline-field { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--mat-sys-on-surface-variant); }
      .action-btn {
        background: linear-gradient(135deg, #34d399 0%, #10b981 55%, #0d9488 100%);
        color: #fff; border: none; border-radius: 10px; padding: 0 18px; height: 44px;
        font-weight: 600; font-size: 0.9rem; display: inline-flex; align-items: center;
        justify-content: center; gap: 6px; cursor: pointer; white-space: nowrap;
      }
      .action-btn.ghost {
        background: transparent; color: var(--mat-sys-on-surface);
        border: 1px solid light-dark(#dbe7e1, #2c3a33);
      }
      .action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .rec-row {
        display: flex; align-items: center; gap: 12px; padding: 12px 4px;
        border-bottom: 1px solid light-dark(#eef4f1, #202a25);
      }
      .rec-row.off { opacity: 0.5; }
      .rec-main { display: flex; flex-direction: column; }
      .rec-desc { font-weight: 600; }
      .rec-meta { font-size: 0.8rem; color: var(--mat-sys-on-surface-variant); margin-top: 2px; }
      .rec-amt { font-family: 'Sora', sans-serif; font-weight: 700; }
      .rec-amt.income { color: light-dark(#0f9d76, #34d399); }
      .empty { color: var(--mat-sys-on-surface-variant); font-size: 0.9rem; }
    `,
  ],
})
export class RecurringComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  readonly items = signal<RecurringTransaction[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly running = signal(false);

  f: {
    description: string;
    amount: number | null;
    direction: Direction;
    frequency: Frequency;
    interval_count: number;
    next_run: string;
    account_id: string | null;
    category_id: string | null;
  } = {
    description: '',
    amount: null,
    direction: 'expense',
    frequency: 'monthly',
    interval_count: 1,
    next_run: new Date().toISOString().slice(0, 10),
    account_id: null,
    category_id: null,
  };

  constructor() {
    forkJoin({
      items: this.api.listRecurring(),
      accounts: this.api.listAccounts(),
      categories: this.api.listCategories(),
    }).subscribe((r) => {
      this.items.set(r.items);
      this.accounts.set(r.accounts);
      this.categories.set(r.categories);
    });
  }

  private reload() {
    this.api.listRecurring().subscribe((r) => this.items.set(r));
  }

  cadence(r: RecurringTransaction): string {
    const n = r.interval_count;
    const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[r.frequency];
    return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
  }

  add() {
    if (!this.f.description || !this.f.amount || !this.f.next_run) return;
    this.api
      .createRecurring({
        description: this.f.description,
        amount: Number(this.f.amount),
        direction: this.f.direction,
        frequency: this.f.frequency,
        interval_count: Number(this.f.interval_count) || 1,
        next_run: this.f.next_run,
        account_id: this.f.account_id ?? undefined,
        category_id: this.f.category_id ?? undefined,
      })
      .subscribe({
        next: () => {
          this.f.description = '';
          this.f.amount = null;
          this.reload();
        },
        error: () => this.snack.open('Could not add', 'OK', { duration: 3000 }),
      });
  }

  toggle(r: RecurringTransaction, is_active: boolean) {
    this.api.updateRecurring(r.id, { is_active }).subscribe(() => this.reload());
  }

  remove(r: RecurringTransaction) {
    this.api.deleteRecurring(r.id).subscribe(() => this.reload());
  }

  runNow() {
    this.running.set(true);
    this.api.runRecurring().subscribe({
      next: (res) => {
        this.running.set(false);
        this.snack.open(
          res.generated ? `Posted ${res.generated} transactions` : 'Nothing due',
          'OK',
          { duration: 3000 },
        );
        this.reload();
      },
      error: () => {
        this.running.set(false);
        this.snack.open('Run failed', 'OK', { duration: 3000 });
      },
    });
  }
}
