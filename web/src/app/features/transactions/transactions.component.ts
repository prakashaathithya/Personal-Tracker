import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../core/api.service';
import { Category, PaymentType, Transaction } from '../../core/models';
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
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatDialogModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Transactions</h1>
        <span class="spacer"></span>
        <button matButton="filled" (click)="openDialog()">
          <mat-icon>add</mat-icon> Add
        </button>
      </div>

      <div class="filters">
        <mat-form-field appearance="outline" class="search">
          <mat-label>Search description</mat-label>
          <input matInput [(ngModel)]="search" (keyup.enter)="applyFilter()" />
          <mat-icon matSuffix (click)="applyFilter()">search</mat-icon>
        </mat-form-field>
        <mat-chip-listbox (change)="onPlannedFilter($event.value)">
          <mat-chip-option value="all" selected>All</mat-chip-option>
          <mat-chip-option value="planned">Planned</mat-chip-option>
          <mat-chip-option value="unplanned">Unplanned</mat-chip-option>
        </mat-chip-listbox>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <table mat-table [dataSource]="rows()" class="full-width">
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Date</th>
          <td mat-cell *matCellDef="let t">{{ t.txn_date | date: 'dd MMM yyyy' }}</td>
        </ng-container>
        <ng-container matColumnDef="description">
          <th mat-header-cell *matHeaderCellDef>Description</th>
          <td mat-cell *matCellDef="let t">{{ t.description }}</td>
        </ng-container>
        <ng-container matColumnDef="category">
          <th mat-header-cell *matHeaderCellDef>Category</th>
          <td mat-cell *matCellDef="let t">{{ t.category?.name ?? '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="payment">
          <th mat-header-cell *matHeaderCellDef>Payment</th>
          <td mat-cell *matCellDef="let t">{{ t.payment_type?.name ?? '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="planned">
          <th mat-header-cell *matHeaderCellDef>Type</th>
          <td mat-cell *matCellDef="let t">{{ t.planned ? 'Planned' : 'Unplanned' }}</td>
        </ng-container>
        <ng-container matColumnDef="amount">
          <th mat-header-cell *matHeaderCellDef class="text-right">Amount</th>
          <td mat-cell *matCellDef="let t" class="text-right">
            {{ t.amount | currency: 'INR' : 'symbol' : '1.0-0' }}
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let t" class="text-right">
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
    </div>
  `,
  styles: [
    `
      .filters { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
      .search { width: 280px; }
      .empty { text-align: center; opacity: 0.6; padding: 32px; }
      table { background: var(--mat-sys-surface, #fff); }
    `,
  ],
})
export class TransactionsComponent {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly columns = ['date', 'description', 'category', 'payment', 'planned', 'amount', 'actions'];
  readonly rows = signal<Transaction[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly pageIndex = signal(0);
  readonly pageSize = 50;

  private categories: Category[] = [];
  private paymentTypes: PaymentType[] = [];

  search = '';
  private planned: boolean | undefined;

  constructor() {
    forkJoin({
      categories: this.api.listCategories(),
      paymentTypes: this.api.listPaymentTypes(),
    }).subscribe((r) => {
      this.categories = r.categories;
      this.paymentTypes = r.paymentTypes;
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
      transaction,
    };
    this.dialog
      .open(TransactionDialogComponent, { data })
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
