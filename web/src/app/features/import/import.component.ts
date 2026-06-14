import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as XLSX from 'xlsx';
import { ApiService } from '../../core/api.service';
import { ImportRow } from '../../core/models';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

@Component({
  selector: 'app-import',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header"><h1>Import from Excel</h1></div>

      <mat-card>
        <mat-card-content>
          <p>
            Upload an <strong>.xlsx</strong> file with columns:
            <em>Date, Month, Description, Amount, Type, PUP, Payment Type</em>
            (the format of your Finance Tracker sheet).
          </p>
          <div class="controls">
            <mat-form-field appearance="outline" class="year">
              <mat-label>Year</mat-label>
              <input matInput type="number" [(ngModel)]="year" />
              <mat-hint>Used when rows only have day + month</mat-hint>
            </mat-form-field>
            <button matButton="filled" (click)="fileInput.click()">
              <mat-icon>upload_file</mat-icon> Choose file
            </button>
            <input #fileInput type="file" accept=".xlsx,.xls" hidden (change)="onFile($event)" />
            <span>{{ fileName() }}</span>
          </div>

          @if (error()) { <p class="error">{{ error() }}</p> }
          @if (importing()) { <mat-progress-bar mode="indeterminate" /> }
        </mat-card-content>
      </mat-card>

      @if (rows().length) {
        <mat-card class="mt">
          <mat-card-header>
            <mat-card-title>Preview</mat-card-title>
            <mat-card-subtitle>{{ rows().length }} rows ready to import</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <table mat-table [dataSource]="preview()" class="full-width">
              <ng-container matColumnDef="txn_date">
                <th mat-header-cell *matHeaderCellDef>Date</th>
                <td mat-cell *matCellDef="let r">{{ r.txn_date | date: 'dd MMM yyyy' }}</td>
              </ng-container>
              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef>Description</th>
                <td mat-cell *matCellDef="let r">{{ r.description }}</td>
              </ng-container>
              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef class="text-right">Amount</th>
                <td mat-cell *matCellDef="let r" class="text-right">{{ r.amount | currency: 'INR' : 'symbol' : '1.0-0' }}</td>
              </ng-container>
              <ng-container matColumnDef="category">
                <th mat-header-cell *matHeaderCellDef>Category</th>
                <td mat-cell *matCellDef="let r">{{ r.category }}</td>
              </ng-container>
              <ng-container matColumnDef="payment_type">
                <th mat-header-cell *matHeaderCellDef>Payment</th>
                <td mat-cell *matCellDef="let r">{{ r.payment_type }}</td>
              </ng-container>
              <ng-container matColumnDef="planned">
                <th mat-header-cell *matHeaderCellDef>Type</th>
                <td mat-cell *matCellDef="let r">{{ r.planned ? 'Planned' : 'Unplanned' }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>
            </table>
            @if (rows().length > preview().length) {
              <p class="muted">…and {{ rows().length - preview().length }} more rows.</p>
            }
          </mat-card-content>
          <mat-card-actions align="end">
            <button matButton (click)="reset()">Clear</button>
            <button matButton="filled" (click)="doImport()" [disabled]="importing()">
              Import {{ rows().length }} transactions
            </button>
          </mat-card-actions>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      .controls { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
      .year { width: 140px; }
      .error { color: #c62828; }
      .muted { opacity: 0.6; margin-top: 8px; }
      .mt { margin-top: 16px; }
    `,
  ],
})
export class ImportComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  readonly columns = ['txn_date', 'description', 'amount', 'category', 'payment_type', 'planned'];
  readonly rows = signal<ImportRow[]>([]);
  readonly fileName = signal('');
  readonly error = signal('');
  readonly importing = signal(false);
  year = new Date().getFullYear();

  preview() {
    return this.rows().slice(0, 15);
  }

  async onFile(event: Event) {
    this.error.set('');
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const sheetName =
        wb.SheetNames.find((n) => n.toLowerCase().includes('expense')) ?? wb.SheetNames[0];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
      const parsed = json
        .map((r) => this.mapRow(r))
        .filter((r): r is ImportRow => r !== null);
      if (parsed.length === 0) {
        this.error.set('No valid rows found. Check the column headers.');
      }
      this.rows.set(parsed);
    } catch {
      this.error.set('Could not read the file. Make sure it is a valid .xlsx.');
    } finally {
      input.value = '';
    }
  }

  private mapRow(r: Record<string, unknown>): ImportRow | null {
    const get = (...keys: string[]): unknown => {
      for (const k of Object.keys(r)) {
        if (keys.some((key) => k.trim().toLowerCase() === key.toLowerCase())) return r[k];
      }
      return undefined;
    };

    const description = String(get('Description', 'Desc') ?? '').trim();
    const amountRaw = get('Amount', 'Amt');
    const amount = Number(amountRaw);
    if (!description || !isFinite(amount) || amount <= 0) return null;

    const date = this.resolveDate(get('Date'), get('Month'));
    if (!date) return null;

    const pup = String(get('PUP', 'Planned') ?? '').trim().toLowerCase();
    return {
      txn_date: date,
      description,
      amount,
      category: this.str(get('Type', 'Category')),
      payment_type: this.str(get('Payment Type', 'PaymentType', 'Payment')),
      planned: pup.startsWith('plan'),
    };
  }

  private str(v: unknown): string | undefined {
    const s = v == null ? '' : String(v).trim();
    return s.length ? s : undefined;
  }

  /** Handles either a real Excel date, or day-number + month-name + chosen year. */
  private resolveDate(dateVal: unknown, monthVal: unknown): string | null {
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      return this.iso(dateVal);
    }
    const day = Number(dateVal);
    const monthStr = String(monthVal ?? '').trim().toLowerCase().slice(0, 3);
    const month = MONTHS[monthStr];
    if (!month || !day || day < 1 || day > 31) return null;
    return `${this.year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private iso(d: Date): string {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  doImport() {
    this.importing.set(true);
    this.api.importTransactions(this.rows()).subscribe({
      next: (res) => {
        this.importing.set(false);
        this.snack.open(`Imported ${res.inserted} transactions`, 'OK', { duration: 4000 });
        this.reset();
      },
      error: (err) => {
        this.importing.set(false);
        this.snack.open(err?.error?.message ?? 'Import failed', 'OK', { duration: 5000 });
      },
    });
  }

  reset() {
    this.rows.set([]);
    this.fileName.set('');
    this.error.set('');
  }
}
