import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../core/api.service';
import { StorageService } from '../../core/storage.service';
import { Account, Category, PaymentType, Transaction } from '../../core/models';
import {
  TransactionDialogComponent,
  TxnDialogData,
} from './transaction-dialog.component';

@Component({
  selector: 'app-transactions',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDialogModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Transactions</h1>
      </div>

      <div class="toolbar">
        <div class="search-box">
          <mat-icon (click)="applyFilter()">search</mat-icon>
          <input
            type="text"
            placeholder="Search description"
            [(ngModel)]="search"
            (keyup.enter)="applyFilter()"
          />
        </div>

        <div class="filter-group">
          <button
            type="button"
            class="filter-pill"
            [class.active]="planned === undefined"
            (click)="onPlannedFilter('all')"
          >
            All
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.active]="planned === true"
            (click)="onPlannedFilter('planned')"
          >
            Planned
          </button>
          <button
            type="button"
            class="filter-pill"
            [class.active]="planned === false"
            (click)="onPlannedFilter('unplanned')"
          >
            Unplanned
          </button>
        </div>

        <span class="spacer"></span>

        <button class="btn-add" matButton="filled" (click)="openDialog()">
          <mat-icon>add</mat-icon> Add
        </button>
      </div>

      <mat-card class="txn-card">
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

        <table mat-table [dataSource]="rows()" class="full-width stacked-table">
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef>Date</th>
            <td mat-cell *matCellDef="let t" class="cell-date">
              {{ t.txn_date | date: 'dd MMM yyyy' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let t" class="description-cell">{{ t.description }}</td>
          </ng-container>
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef>Category</th>
            <td mat-cell *matCellDef="let t" class="cell-category">{{ t.category?.name ?? '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="account">
            <th mat-header-cell *matHeaderCellDef>Account</th>
            <td mat-cell *matCellDef="let t" class="cell-account">
              @if (t.direction === 'transfer') {
                {{ t.account?.name ?? '—' }} → {{ t.transfer_account?.name ?? '—' }}
              } @else {
                {{ t.account?.name ?? '—' }}
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let t" class="cell-type">
              <span class="badge badge-{{ t.direction }}">{{ t.direction }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef class="text-right">Amount</th>
            <td
              mat-cell
              *matCellDef="let t"
              class="text-right amount-cell"
              [class.amount-income]="t.direction === 'income'"
            >
              {{ t.direction === 'income' ? '+' : t.direction === 'expense' ? '−' : '' }}{{ t.amount | currency: 'INR' : 'symbol' : '1.0-0' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let t" class="text-right actions-cell">
              <button matIconButton (click)="openDialog(t)"><mat-icon>edit</mat-icon></button>
              <button matIconButton (click)="remove(t)"><mat-icon>delete</mat-icon></button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>

        @if (!loading() && rows().length === 0) {
          <p class="empty">No transactions yet. Click “Add” or import from Excel.</p>
        }

        <mat-paginator
          [length]="total()"
          [pageSize]="pageSize"
          [pageIndex]="pageIndex()"
          [pageSizeOptions]="[25, 50, 100]"
          (page)="onPage($event)"
        />
      </mat-card>
    </div>
  `,
  styles: [
    `
      .toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }

      .search-box {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1 1 280px;
        max-width: 420px;
        padding: 9px 16px;
        border-radius: 999px;
        background: var(--surface-2);
        border: 1px solid var(--field-border);

        mat-icon {
          color: var(--ink-faint);
          cursor: pointer;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }

        input {
          border: none;
          outline: none;
          background: transparent;
          flex: 1;
          font-size: 0.95rem;
          color: var(--mat-sys-on-surface);
          font-family: inherit;

          &::placeholder { color: var(--ink-faint); }
        }
      }

      .filter-group {
        display: flex;
        gap: 6px;
      }

      .filter-pill {
        padding: 9px 20px;
        border-radius: 999px;
        border: 1px solid var(--field-border);
        background: var(--surface-2);
        color: var(--mat-sys-on-surface);
        font-family: inherit;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease;

        &:hover { border-color: color-mix(in srgb, var(--mat-sys-primary) 40%, transparent); }

        &.active {
          background: var(--mat-sys-primary-container);
          border-color: color-mix(in srgb, var(--mat-sys-primary) 45%, transparent);
          color: var(--mat-sys-on-primary-container);
        }
      }

      .btn-add.mat-mdc-unelevated-button {
        border-radius: 999px !important;
        padding-inline: 22px !important;
        font-weight: 700;
      }

      .txn-card.mat-mdc-card {
        padding: 0 !important;
        overflow: hidden;
      }

      table { background: transparent; }

      .mat-mdc-header-row {
        background: var(--surface-2);
      }
      .mat-mdc-header-cell {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--ink-faint);
        padding: 14px 16px;
      }
      .mat-mdc-cell {
        padding: 14px 16px;
        font-size: 0.92rem;
      }
      .description-cell { font-weight: 600; }
      .amount-cell { font-weight: 700; }
      .actions-cell {
        button.mat-mdc-icon-button {
          width: 36px;
          height: 36px;
          padding: 6px;
          color: var(--ink-faint);

          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
      }

      .badge {
        display: inline-block;
        padding: 4px 14px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 600;
        text-transform: capitalize;
      }
      .badge-expense {
        background: light-dark(#fef3c7, #3a2f12);
        color: light-dark(#92400e, #fcd34d);
      }
      .badge-income {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }
      .badge-transfer {
        background: light-dark(#e0f2fe, #0c2a3a);
        color: light-dark(#075985, #7dd3fc);
      }
      .amount-income { color: var(--accent-ink); }

      .empty { text-align: center; opacity: 0.6; padding: 32px; }

      /* ---- Phone: each row becomes a transaction card ---------------
         Four-column grid so the three meta cells (date / category /
         account) share one line without needing a wrapper element —
         mat-table renders cells as direct children of the row, so
         grid-template-areas is the only way to regroup them. */
      @media (max-width: 700px) {
        .toolbar {
          gap: 10px;
          margin-bottom: 14px;
        }
        .search-box {
          flex: 1 1 100%;
          max-width: none;
        }
        .filter-group {
          flex: 1 1 auto;
        }
        .filter-pill {
          flex: 1;
          padding: 10px 12px;
          font-size: 0.85rem;
        }
        .btn-add.mat-mdc-unelevated-button {
          flex: 0 0 auto;
          min-height: 44px;
        }

        .stacked-table tr.mat-mdc-row {
          display: grid;
          grid-template-columns: auto auto 1fr auto;
          grid-template-areas:
            'desc desc desc   amount'
            'date cat  acct   acct'
            'type type .      actions';
          align-items: center;
          gap: 4px 8px;
          padding: 12px 14px;
        }

        .description-cell {
          grid-area: desc;
          font-size: 0.98rem;
          font-weight: 700;
          color: var(--ink);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .amount-cell {
          grid-area: amount;
          justify-self: end;
          font-size: 1rem;
          white-space: nowrap;
        }

        .cell-date { grid-area: date; }
        .cell-category { grid-area: cat; }
        .cell-account {
          grid-area: acct;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cell-date,
        .cell-category,
        .cell-account {
          font-size: 0.78rem !important;
          color: var(--ink-faint);
        }
        /* Middot separators between the meta cells. */
        .cell-date::after,
        .cell-category::after {
          content: '·';
          margin-left: 8px;
          opacity: 0.6;
        }

        .cell-type { grid-area: type; }
        .actions-cell {
          grid-area: actions;
          justify-self: end;
          display: flex;
          gap: 2px;
        }
        .actions-cell button.mat-mdc-icon-button {
          width: 40px;
          height: 40px;
          padding: 8px;

          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }
      }
    `,
  ],
})
export class TransactionsComponent {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly columns = ['date', 'description', 'category', 'account', 'type', 'amount', 'actions'];
  readonly rows = signal<Transaction[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly pageIndex = signal(0);
  readonly pageSize = 50;

  private categories: Category[] = [];
  private paymentTypes: PaymentType[] = [];
  private accounts: Account[] = [];

  search = '';
  planned: boolean | undefined;

  constructor() {
    forkJoin({
      categories: this.api.listCategories(),
      paymentTypes: this.api.listPaymentTypes(),
      accounts: this.api.listAccounts(),
    }).subscribe((r) => {
      this.categories = r.categories;
      this.paymentTypes = r.paymentTypes;
      this.accounts = r.accounts;
    });
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.api
      .listTransactions({
        search: this.search || undefined,
        planned: this.planned,
        limit: this.pageSize,
        offset: this.pageIndex() * this.pageSize,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.total.set(res.count);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  applyFilter() {
    this.pageIndex.set(0);
    this.load();
  }

  onPlannedFilter(value: string) {
    this.planned = value === 'planned' ? true : value === 'unplanned' ? false : undefined;
    this.applyFilter();
  }

  onPage(e: PageEvent) {
    this.pageIndex.set(e.pageIndex);
    this.load();
  }

  openDialog(transaction?: Transaction) {
    const data: TxnDialogData = {
      categories: this.categories,
      paymentTypes: this.paymentTypes,
      accounts: this.accounts,
      transaction,
    };
    this.dialog
      .open(TransactionDialogComponent, {
        data,
        width: '480px',
        maxWidth: '94vw',
        panelClass: 'txn-dialog-panel',
      })
      .afterClosed()
      .subscribe((result?: Partial<Transaction>) => {
        if (!result) return;
        const req = transaction
          ? this.api.updateTransaction(transaction.id, result)
          : this.api.createTransaction(result);
        req.subscribe({
          next: () => {
            this.snack.open('Saved', 'OK', { duration: 2000 });
            this.load();
          },
          error: (err) => this.snack.open(err?.error?.message ?? 'Save failed', 'OK', { duration: 4000 }),
        });
      });
  }

  remove(t: Transaction) {
    if (!confirm(`Delete "${t.description}"?`)) return;
    this.api.deleteTransaction(t.id).subscribe({
      next: () => {
        this.snack.open('Deleted', 'OK', { duration: 2000 });
        this.load();
      },
      error: () => this.snack.open('Delete failed', 'OK', { duration: 3000 }),
    });
  }
}
