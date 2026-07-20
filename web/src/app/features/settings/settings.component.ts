import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { Category, NeedClass, PaymentType } from '../../core/models';

const PAYMENT_ICONS: Record<string, string> = {
  'auto debit': 'autorenew',
  cash: 'payments',
  'credit card': 'credit_card',
  'debit card': 'local_atm',
  emi: 'info',
  upi: 'dialpad',
};

@Component({
  selector: 'app-settings',
  imports: [FormsModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Settings</h1>
          <p class="page-subtitle">Manage the categories and payment types used across your transactions.</p>
        </div>
      </div>

      <div class="grid">
        <mat-card>
          <mat-card-content>
            <div class="card-title-row">
              <h2>Categories</h2>
              <span class="count-badge">{{ categories().length }}</span>
            </div>

            <div class="add-row">
              <input class="field grow" placeholder="New category name" [(ngModel)]="newCat" />
              <div class="select-wrap">
                <select class="field select-field" [(ngModel)]="newCatClass">
                  @for (nc of needClasses; track nc) {
                    <option [value]="nc">{{ nc }}</option>
                  }
                </select>
                <mat-icon class="select-chevron">expand_more</mat-icon>
              </div>
              <button matButton="filled" class="add-btn" (click)="addCategory()">
                <mat-icon>add</mat-icon> Add
              </button>
            </div>

            <div class="search-wrap">
              <mat-icon class="search-icon">search</mat-icon>
              <input class="field search-field" placeholder="Search categories" [(ngModel)]="categorySearch" />
            </div>

            <div class="scroll-list">
              @for (c of filteredCategories(); track c.id) {
                <div class="row-item">
                  <span class="row-name">{{ c.name }}</span>
                  <span class="pill" [class]="pillClass(c.need_class)">{{ c.need_class }}</span>
                  <button matIconButton class="delete-btn" (click)="deleteCategory(c)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              }
              @if (!filteredCategories().length) {
                <p class="empty">No categories found.</p>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-content>
            <div class="card-title-row">
              <h2>Payment types</h2>
              <span class="count-badge">{{ paymentTypes().length }}</span>
            </div>

            <div class="add-row">
              <input class="field grow" placeholder="New payment type" [(ngModel)]="newPay" />
              <button matButton="filled" class="add-btn" (click)="addPayment()">
                <mat-icon>add</mat-icon> Add
              </button>
            </div>

            <div class="scroll-list">
              @for (p of paymentTypes(); track p.id) {
                <div class="row-item">
                  <span class="icon-badge"><mat-icon>{{ paymentIcon(p.name) }}</mat-icon></span>
                  <span class="row-name">{{ p.name }}</span>
                  <button matIconButton class="delete-btn" (click)="deletePayment(p)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .page-subtitle {
        margin: 4px 0 0;
        font-size: 0.9rem;
        color: var(--mat-sys-on-surface-variant);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
        gap: 16px;
      }
      .card-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;

        h2 {
          margin: 0;
          font-family: 'Inter', sans-serif;
          font-size: 1.15rem;
          font-weight: 700;
        }
      }
      .count-badge {
        min-width: 22px;
        height: 22px;
        padding: 0 7px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--accent-ink);
        background: color-mix(in srgb, var(--mat-sys-primary) 14%, transparent);
      }

      /* ---- Flat field styling: shared by text input, select, search ---- */
      .field {
        box-sizing: border-box;
        height: 48px;
        padding: 0 14px;
        border-radius: 10px;
        border: 1px solid var(--hairline);
        background: var(--surface-2);
        color: var(--mat-sys-on-surface);
        font-family: 'Inter', sans-serif;
        font-size: 0.95rem;
        outline: none;
        transition: border-color 0.15s ease;

        &::placeholder { color: var(--mat-sys-on-surface-variant); }
        &:focus { border-color: color-mix(in srgb, var(--mat-sys-primary) 55%, transparent); }
      }

      .add-row {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 12px;
      }
      .grow { flex: 1 1 auto; min-width: 0; }
      .select-wrap {
        position: relative;
        flex: 0 0 130px;
      }
      .select-field {
        width: 100%;
        appearance: none;
        padding-right: 30px;
        cursor: pointer;
      }
      .select-chevron {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--mat-sys-on-surface-variant);
        pointer-events: none;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .add-btn {
        flex: 0 0 auto;
        height: 48px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }
      .search-wrap {
        position: relative;
        margin-bottom: 4px;
      }
      .search-field {
        width: 100%;
        padding-left: 40px;
      }
      .search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--mat-sys-on-surface-variant);
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .scroll-list {
        max-height: 380px;
        overflow-y: auto;
        margin-top: 8px;
        scrollbar-width: thin;
        scrollbar-color: light-dark(rgba(20,45,60,0.25), rgba(255,255,255,0.15)) transparent;

        &::-webkit-scrollbar { width: 6px; }
        &::-webkit-scrollbar-track { background: transparent; }
        &::-webkit-scrollbar-thumb {
          background: light-dark(rgba(20,45,60,0.25), rgba(255,255,255,0.15));
          border-radius: 999px;
        }
      }
      .row-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 4px;
        border-bottom: 1px solid var(--hairline);

        &:last-child { border-bottom: none; }
      }
      .row-name {
        font-weight: 500;
        flex: 1 1 auto;
      }
      .delete-btn {
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.6;

        &:hover { opacity: 1; color: var(--danger); }
      }
      .icon-badge {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 9px;
        background: var(--hover-bg);
        color: var(--mat-sys-on-surface-variant);

        mat-icon { font-size: 19px; width: 19px; height: 19px; }
      }
      .empty {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.9rem;
        padding: 12px 4px;
      }
      .pill {
        font-size: 0.75rem;
        font-weight: 700;
        padding: 4px 12px;
        border-radius: 999px;
        white-space: nowrap;
      }
      .pill-needs { color: light-dark(#1d4ed8, #93c5fd); background: light-dark(#dbeafe, rgba(59,130,246,0.18)); }
      .pill-wants { color: light-dark(#92400e, #fcd34d); background: light-dark(#fef3c7, rgba(217,119,6,0.18)); }
      .pill-saving { color: light-dark(#047857, #6ee7b7); background: light-dark(#d1fae5, rgba(16,185,129,0.18)); }
      .pill-others { color: light-dark(#6b7280, #cbd5e1); background: light-dark(#e5e7eb, rgba(148,163,184,0.18)); }

      /* ---- Phone ---- */
      @media (max-width: 700px) {
        /* Name / need-class / Add wrap onto their own lines. */
        .add-row { flex-wrap: wrap; }
        .grow { flex: 1 1 100%; }
        .select-wrap { flex: 1 1 auto; }
        .add-btn { flex: 0 0 auto; }
        .field, .select-field, .search-field { font-size: 16px; }

        /* The inner scroll region fights the page scroll on touch; let the
           page own the scrolling and the list grow instead. */
        .scroll-list { max-height: none; overflow-y: visible; }

        .row-item { gap: 10px; }
        .row-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      }
    `,
  ],
})
export class SettingsComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  readonly needClasses: NeedClass[] = ['Needs', 'Wants', 'Saving', 'Others'];
  readonly categories = signal<Category[]>([]);
  readonly paymentTypes = signal<PaymentType[]>([]);

  categorySearch = '';
  readonly filteredCategories = computed(() => {
    const q = this.categorySearch.trim().toLowerCase();
    if (!q) return this.categories();
    return this.categories().filter((c) => c.name.toLowerCase().includes(q));
  });

  newCat = '';
  newCatClass: NeedClass = 'Others';
  newPay = '';

  constructor() {
    this.loadCategories();
    this.loadPayments();
  }

  private loadCategories() {
    this.api.listCategories().subscribe((r) => this.categories.set(r));
  }
  private loadPayments() {
    this.api.listPaymentTypes().subscribe((r) => this.paymentTypes.set(r));
  }

  pillClass(nc: NeedClass): string {
    return `pill-${nc.toLowerCase()}`;
  }

  paymentIcon(name: string): string {
    return PAYMENT_ICONS[name.trim().toLowerCase()] ?? 'account_balance_wallet';
  }

  addCategory() {
    if (!this.newCat.trim()) return;
    this.api
      .createCategory({ name: this.newCat, need_class: this.newCatClass })
      .subscribe({
        next: () => {
          this.newCat = '';
          this.loadCategories();
        },
        error: (err) => this.snack.open(err?.error?.message ?? 'Failed', 'OK', { duration: 3000 }),
      });
  }
  deleteCategory(c: Category) {
    this.api.deleteCategory(c.id).subscribe(() => this.loadCategories());
  }

  addPayment() {
    if (!this.newPay.trim()) return;
    this.api.createPaymentType({ name: this.newPay }).subscribe({
      next: () => {
        this.newPay = '';
        this.loadPayments();
      },
      error: (err) => this.snack.open(err?.error?.message ?? 'Failed', 'OK', { duration: 3000 }),
    });
  }
  deletePayment(p: PaymentType) {
    this.api.deletePaymentType(p.id).subscribe(() => this.loadPayments());
  }
}
