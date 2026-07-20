import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule, MatCheckboxChange } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as XLSX from 'xlsx';
import { ApiService } from '../../core/api.service';
import { ImportRow, NeedClass } from '../../core/models';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const PAYMENT_ICONS: Record<string, string> = {
  'auto debit': 'autorenew',
  cash: 'payments',
  'credit card': 'credit_card',
  'debit card': 'local_atm',
  emi: 'info',
  upi: 'dialpad',
};

const EXPECTED_COLUMNS = ['Date', 'Month', 'Description', 'Amount', 'Type', 'PUP', 'Payment Type'];

type ReviewFilter = 'all' | 'planned' | 'unplanned' | 'review' | 'duplicate';

interface PreviewRow extends ImportRow {
  selected: boolean;
  newCategory: boolean;
  duplicate: boolean;
  reviewReason: string | null;
}

@Component({
  selector: 'app-import',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatCheckboxModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="breadcrumb">DATA <mat-icon>chevron_right</mat-icon> <span>IMPORT</span></div>
      <div class="page-header"><h1>Import from Excel</h1></div>

      <div class="stepper">
        <div class="step" [class.done]="stepIndex() > 1" [class.active]="stepIndex() === 1">
          <span class="step-circle">
            @if (stepIndex() > 1) { <mat-icon>check</mat-icon> } @else { 1 }
          </span>
          <span class="step-label">Upload</span>
        </div>
        <div class="step-line" [class.filled]="stepIndex() > 1"></div>
        <div class="step" [class.done]="stepIndex() > 2" [class.active]="stepIndex() === 2">
          <span class="step-circle">
            @if (stepIndex() > 2) { <mat-icon>check</mat-icon> } @else { 2 }
          </span>
          <span class="step-label">Review</span>
        </div>
        <div class="step-line" [class.filled]="stepIndex() > 2"></div>
        <div class="step" [class.active]="stepIndex() === 3">
          <span class="step-circle">3</span>
          <span class="step-label">Import</span>
        </div>
      </div>

      <div class="top-grid">
        <mat-card class="source-card">
          <mat-card-content>
            <div class="source-head">
              <div>
                <div class="card-title">Source file</div>
                <div class="columns-list">
                  Columns:
                  @for (col of expectedColumns; track col) {
                    <span class="col-chip">{{ col }}</span>
                  }
                </div>
              </div>
              <button type="button" class="link-btn" (click)="downloadTemplate()">
                <mat-icon>download</mat-icon> Download template
              </button>
            </div>

            <div class="source-body">
              <div
                class="dropzone"
                [class.drag]="dragOver()"
                (click)="fileInput.click()"
                (dragover)="onDragOver($event)"
                (dragleave)="onDragLeave()"
                (drop)="onDrop($event)"
              >
                <span class="dropzone-icon"><mat-icon>upload</mat-icon></span>
                <div class="dropzone-text">
                  @if (fileName()) {
                    <div class="file-name">{{ fileName() }} <span class="file-size">{{ fileSize() }}</span></div>
                    <div class="file-hint">Click to replace, or drag a new .xlsx file here</div>
                  } @else {
                    <div class="file-name">Choose an .xlsx file</div>
                    <div class="file-hint">Click to browse, or drag a file here</div>
                  }
                </div>
              </div>
              <input #fileInput type="file" accept=".xlsx,.xls" hidden (change)="onFile($event)" />

              <div class="year-field">
                <label class="field-label">Year</label>
                <div class="plain-input-wrap">
                  <input class="plain-input" type="number" [(ngModel)]="year" />
                </div>
                <div class="field-hint">Fallback when rows have day + month only</div>
              </div>
            </div>

            @if (error()) { <p class="error">{{ error() }}</p> }
            @if (importing()) { <mat-progress-bar mode="indeterminate" /> }
          </mat-card-content>
        </mat-card>

        <mat-card class="summary-card">
          <mat-card-content>
            <div class="card-title">Summary</div>
            @if (rows().length) {
              <div class="card-subtitle">Parsed from {{ fileName() }}</div>
              <div class="summary-grid">
                <div class="summary-tile">
                  <div class="tile-label">ROWS PARSED</div>
                  <div class="tile-value">{{ rows().length }}</div>
                  <div class="tile-sub">no format errors</div>
                </div>
                <div class="summary-tile" [class.warn]="reviewCount() > 0">
                  <div class="tile-label">NEEDS REVIEW</div>
                  <div class="tile-value">{{ reviewCount() }}</div>
                  <div class="tile-sub">typos, new categories</div>
                </div>
                <div class="summary-tile">
                  <div class="tile-label">TOTAL</div>
                  <div class="tile-value accent">{{ formatCompact(totalAmount()) }}</div>
                  <div class="tile-sub">sum of Amount column</div>
                </div>
                <div class="summary-tile">
                  <div class="tile-label">DATE RANGE</div>
                  <div class="tile-value">{{ dateRangeLabel() }}</div>
                  <div class="tile-sub">{{ dateRangeYear() }}</div>
                </div>
              </div>
            } @else {
              <p class="summary-empty">Upload a file to see a summary here.</p>
            }
          </mat-card-content>
        </mat-card>
      </div>

      @if (rows().length) {
        <mat-card class="preview-card">
          <mat-card-content>
            <div class="preview-head">
              <span class="card-title">Preview</span>
              <span class="count-pill">{{ rows().length }} rows</span>
              @if (reviewCount() > 0) {
                <span class="count-pill warn"><mat-icon>warning</mat-icon> {{ reviewCount() }} need review</span>
              }
              @if (duplicateCount() > 0) {
                <span class="count-pill dup"><mat-icon>content_copy</mat-icon> {{ duplicateCount() }} duplicate{{ duplicateCount() === 1 ? '' : 's' }} skipped</span>
              }
            </div>

            <div class="toolbar">
              <div class="filter-group">
                <button type="button" class="filter-pill" [class.active]="filter() === 'all'" (click)="filter.set('all')">
                  All <span class="pill-count">{{ rows().length }}</span>
                </button>
                <button type="button" class="filter-pill" [class.active]="filter() === 'planned'" (click)="filter.set('planned')">
                  Planned <span class="pill-count">{{ plannedCount() }}</span>
                </button>
                <button type="button" class="filter-pill" [class.active]="filter() === 'unplanned'" (click)="filter.set('unplanned')">
                  Unplanned <span class="pill-count">{{ unplannedCount() }}</span>
                </button>
                <button type="button" class="filter-pill" [class.active]="filter() === 'review'" (click)="filter.set('review')">
                  Review <span class="pill-count">{{ reviewCount() }}</span>
                </button>
                @if (duplicateCount() > 0) {
                  <button type="button" class="filter-pill" [class.active]="filter() === 'duplicate'" (click)="filter.set('duplicate')">
                    Duplicates <span class="pill-count">{{ duplicateCount() }}</span>
                  </button>
                }
              </div>
              <span class="spacer"></span>
              <div class="search-box">
                <mat-icon>search</mat-icon>
                <input
                  type="text"
                  placeholder="Search description"
                  [ngModel]="search()"
                  (ngModelChange)="search.set($event)"
                />
              </div>
            </div>

            <!-- Wide preview grid: scrolls sideways on a phone rather than
                 stacking, so rows stay comparable while ticking them off. -->
            <div class="scroll-x">
            <table mat-table [dataSource]="filteredRows()" class="full-width">
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef>
                  <mat-checkbox [checked]="allVisibleSelected()" (change)="toggleAll($event)" />
                </th>
                <td mat-cell *matCellDef="let r">
                  <mat-checkbox [checked]="r.selected" (change)="toggleRow(r)" />
                </td>
              </ng-container>

              <ng-container matColumnDef="txn_date">
                <th mat-header-cell *matHeaderCellDef>Date</th>
                <td mat-cell *matCellDef="let r">{{ r.txn_date | date: 'dd MMM yyyy' }}</td>
              </ng-container>

              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef>Description</th>
                <td mat-cell *matCellDef="let r" class="description-cell">
                  {{ r.description }}
                  @if (r.reviewReason) { <span class="chip-review">{{ r.reviewReason }}</span> }
                </td>
              </ng-container>

              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef class="text-right">Amount</th>
                <td mat-cell *matCellDef="let r" class="text-right amount-cell">
                  {{ r.amount | currency: 'INR' : 'symbol' : '1.0-0' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="category">
                <th mat-header-cell *matHeaderCellDef>Category</th>
                <td mat-cell *matCellDef="let r">
                  @if (r.category) {
                    <span class="pill" [class]="r.newCategory ? 'pill-new' : pillClass(r.category)">{{ r.category }}</span>
                  } @else {
                    <span class="pill pill-others">Uncategorized</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="payment_type">
                <th mat-header-cell *matHeaderCellDef>Payment</th>
                <td mat-cell *matCellDef="let r">
                  <span class="payment-cell">
                    <mat-icon>{{ paymentIcon(r.payment_type) }}</mat-icon>
                    {{ r.payment_type ?? '—' }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="planned">
                <th mat-header-cell *matHeaderCellDef>Type</th>
                <td mat-cell *matCellDef="let r">
                  <span class="badge" [class.badge-planned]="r.planned" [class.badge-unplanned]="!r.planned">
                    {{ r.planned ? 'Planned' : 'Unplanned' }}
                  </span>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns" [class.row-review]="row.reviewReason"></tr>
            </table>
            </div>

            @if (!filteredRows().length) {
              <p class="empty">No rows match your filters.</p>
            }
          </mat-card-content>
        </mat-card>

        <div class="import-bar">
          <div class="import-summary">
            <strong>{{ selectedRows().length }}</strong>
            transaction{{ selectedRows().length === 1 ? '' : 's' }} will be imported
            <span class="dot-sep">&middot;</span>
            Total {{ selectedTotal() | currency: 'INR' : 'symbol' : '1.0-0' }}
          </div>
          <span class="spacer"></span>
          <button type="button" class="btn-secondary" (click)="reset()" [disabled]="importing()">Cancel</button>
          <button
            type="button"
            class="btn-primary"
            (click)="doImport()"
            [disabled]="importing() || !selectedRows().length"
          >
            Import {{ selectedRows().length }} row{{ selectedRows().length === 1 ? '' : 's' }}
            <mat-icon>arrow_forward</mat-icon>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 2px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
        margin-bottom: 6px;

        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        span { color: var(--accent-ink); }
      }

      /* ---- Stepper ---- */
      .stepper {
        display: flex;
        align-items: center;
        margin-bottom: 24px;
      }
      .step {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 0 0 auto;
      }
      .step-circle {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 2px solid var(--field-border);
        color: var(--mat-sys-on-surface-variant);
        font-weight: 700;
        font-size: 0.85rem;
        flex-shrink: 0;

        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
      .step-label {
        font-weight: 600;
        font-size: 0.92rem;
        color: var(--mat-sys-on-surface-variant);
        white-space: nowrap;
      }
      .step.done .step-circle {
        background: var(--mat-sys-primary);
        border-color: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
      }
      .step.done .step-label { color: var(--mat-sys-on-surface); }
      .step.active .step-circle {
        border-color: var(--mat-sys-primary);
        color: var(--accent-ink);
      }
      .step.active .step-label { color: var(--mat-sys-on-surface); }
      .step-line {
        flex: 1 1 auto;
        height: 2px;
        margin: 0 16px;
        background: var(--field-border);
      }
      .step-line.filled { background: var(--mat-sys-primary); }

      /* ---- Top grid ---- */
      .top-grid {
        display: grid;
        grid-template-columns: 1.3fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }
      @media (max-width: 860px) {
        .top-grid { grid-template-columns: 1fr; }
      }

      .card-title { font-weight: 700; font-size: 1.05rem; }
      .card-subtitle {
        font-size: 0.85rem;
        color: var(--mat-sys-on-surface-variant);
        margin-top: 2px;
      }

      .source-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }
      .columns-list {
        margin-top: 8px;
        font-size: 0.82rem;
        color: var(--mat-sys-on-surface-variant);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      .col-chip {
        padding: 2px 8px;
        border-radius: 6px;
        background: var(--surface-2);
        font-size: 0.78rem;
      }
      .link-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: none;
        background: none;
        color: var(--accent-ink);
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
        white-space: nowrap;
        padding: 4px;

        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        &:hover { text-decoration: underline; }
      }

      .source-body { display: flex; gap: 16px; align-items: stretch; flex-wrap: wrap; }

      .dropzone {
        flex: 1 1 260px;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px;
        border-radius: 12px;
        border: 1.5px dashed var(--field-border);
        background: var(--surface-2);
        cursor: pointer;
        transition: border-color 120ms ease, background 120ms ease;

        &:hover, &.drag {
          border-color: var(--mat-sys-primary);
          background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
        }
      }
      .dropzone-icon {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 10px;
        flex-shrink: 0;
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);

        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
      .file-name { font-weight: 700; font-size: 0.92rem; }
      .file-size {
        font-weight: 500;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.78rem;
      }
      .file-hint {
        font-size: 0.8rem;
        color: var(--mat-sys-on-surface-variant);
        margin-top: 2px;
      }

      .year-field {
        flex: 0 0 140px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .field-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--mat-sys-on-surface-variant);
      }
      .field-hint {
        font-size: 0.72rem;
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.85;
      }
      .plain-input-wrap { display: flex; }
      .plain-input {
        width: 100%;
        height: 44px;
        padding: 0 14px;
        border-radius: 10px;
        border: 1px solid var(--field-border);
        background: var(--field-bg);
        color: inherit;
        font-family: 'Inter', sans-serif;
        font-size: 0.92rem;
        box-sizing: border-box;
        outline: none;
        transition: border-color 150ms ease;
      }
      .plain-input:focus { border-color: var(--mat-sys-primary); }

      .error { color: var(--danger); margin-top: 12px; margin-bottom: 0; }

      /* ---- Summary card ---- */
      .summary-empty {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.88rem;
        margin-top: 12px;
      }
      .summary-grid {
        margin-top: 16px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .summary-tile {
        padding: 14px;
        border-radius: 12px;
        background: var(--surface-2);
      }
      .summary-tile.warn {
        background: light-dark(#fef3c7, rgba(217, 119, 6, 0.14));
      }
      .tile-label {
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }
      .tile-value {
        font-family: 'Inter', sans-serif;
        font-size: 1.4rem;
        font-weight: 700;
        margin-top: 6px;
      }
      .tile-value.accent { color: var(--accent-ink); }
      .summary-tile.warn .tile-value { color: light-dark(#92400e, #fcd34d); }
      .tile-sub {
        font-size: 0.75rem;
        color: var(--mat-sys-on-surface-variant);
        margin-top: 2px;
      }

      /* ---- Preview card ---- */
      .preview-card.mat-mdc-card { padding-bottom: 4px !important; }
      .preview-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
      }
      .count-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 12px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 600;
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);

        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
      .count-pill.warn {
        background: light-dark(#fef3c7, rgba(217, 119, 6, 0.18));
        color: light-dark(#92400e, #fcd34d);
      }
      .count-pill.dup {
        background: light-dark(#fee2e2, rgba(220, 38, 38, 0.18));
        color: light-dark(#b91c1c, #fca5a5);
      }

      .toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .filter-group { display: flex; gap: 6px; flex-wrap: wrap; }
      .filter-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 999px;
        border: 1px solid var(--field-border);
        background: var(--surface-2);
        color: var(--mat-sys-on-surface);
        font-family: inherit;
        font-size: 0.85rem;
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
      .pill-count {
        font-size: 0.72rem;
        opacity: 0.75;
      }

      .search-box {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1 1 240px;
        max-width: 320px;
        padding: 7px 14px;
        border-radius: 999px;
        background: var(--surface-2);
        border: 1px solid var(--field-border);

        mat-icon {
          color: var(--ink-faint);
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
        input {
          border: none;
          outline: none;
          background: transparent;
          flex: 1;
          font-size: 0.9rem;
          color: var(--mat-sys-on-surface);
          font-family: inherit;

          &::placeholder { color: var(--ink-faint); }
        }
      }

      table { background: transparent; }
      .mat-mdc-header-cell {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--ink-faint);
      }
      .description-cell { font-weight: 600; }
      .amount-cell { font-weight: 700; }
      .row-review { background: light-dark(rgba(217, 119, 6, 0.05), rgba(217, 119, 6, 0.08)); }

      .chip-review {
        display: inline-block;
        margin-left: 8px;
        padding: 2px 9px;
        border-radius: 999px;
        font-size: 0.68rem;
        font-weight: 700;
        background: light-dark(#fef3c7, rgba(217, 119, 6, 0.18));
        color: light-dark(#92400e, #fcd34d);
        vertical-align: middle;
      }

      .pill {
        display: inline-block;
        padding: 3px 12px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 600;
      }
      .pill-needs { color: light-dark(#1d4ed8, #93c5fd); background: light-dark(#dbeafe, rgba(59, 130, 246, 0.18)); }
      .pill-wants { color: light-dark(#92400e, #fcd34d); background: light-dark(#fef3c7, rgba(217, 119, 6, 0.18)); }
      .pill-saving { color: light-dark(#047857, #6ee7b7); background: light-dark(#d1fae5, rgba(16, 185, 129, 0.18)); }
      .pill-others { color: light-dark(#6b7280, #cbd5e1); background: light-dark(#e5e7eb, rgba(148, 163, 184, 0.18)); }
      .pill-new {
        color: light-dark(#92400e, #fcd34d);
        background: transparent;
        border: 1.5px dashed light-dark(#d97706, #fcd34d);
      }

      .payment-cell {
        display: inline-flex;
        align-items: center;
        gap: 6px;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: var(--mat-sys-on-surface-variant);
        }
      }

      .badge {
        display: inline-block;
        padding: 4px 14px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 600;
      }
      .badge-planned {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }
      .badge-unplanned {
        background: light-dark(#fef3c7, #3a2f12);
        color: light-dark(#92400e, #fcd34d);
      }

      .empty { text-align: center; opacity: 0.6; padding: 24px; }

      /* ---- Sticky import bar ---- */
      .import-bar {
        position: sticky;
        bottom: 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        margin-top: 16px;
        padding: 14px 20px;
        border-radius: 14px;
        background: var(--surface-2);
        border: 1px solid var(--hairline);
        box-shadow: 0 12px 28px light-dark(rgba(16, 40, 30, 0.12), rgba(0, 0, 0, 0.45));
      }
      .import-summary { font-size: 0.9rem; }
      .dot-sep { margin: 0 6px; opacity: 0.5; }

      .btn-secondary {
        height: 42px;
        padding: 0 20px;
        border-radius: 10px;
        border: 1px solid var(--field-border);
        background: transparent;
        color: var(--mat-sys-on-surface);
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;

        &:disabled { opacity: 0.5; cursor: not-allowed; }
      }
      .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 42px;
        padding: 0 20px;
        border-radius: 10px;
        border: none;
        background: var(--accent-grad);
        color: var(--on-accent);
        font-weight: 700;
        font-size: 0.9rem;
        cursor: pointer;
        box-shadow:
          0 4px 14px oklch(0.6 0.15 168 / 0.35),
          0 6px 14px rgba(16, 185, 129, 0.35);
        transition: transform 90ms ease, box-shadow 90ms ease;

        mat-icon { font-size: 18px; width: 18px; height: 18px; }
        &:active:not(:disabled) {
          transform: translateY(3px);
          box-shadow:
            0 1px 6px oklch(0.6 0.15 168 / 0.3),
            0 2px 6px rgba(16, 185, 129, 0.3);
        }
        &:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
      }

      /* ---- Phone ---- */
      @media (max-width: 700px) {
        .summary-grid { grid-template-columns: 1fr; }
        .source-body { flex-direction: column; }
        .search-box { flex: 1 1 100%; max-width: none; }
        .toolbar { gap: 10px; }

        /* Let the preview grid scroll edge-to-edge inside its card. */
        .scroll-x {
          margin-inline: -16px;
          padding-inline: 16px;
        }
        .scroll-x .mat-mdc-cell,
        .scroll-x .mat-mdc-header-cell {
          padding: 10px;
          white-space: nowrap;
        }
        .scroll-x .description-cell {
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Sticky action bar clears the bottom tab bar and stacks its
           buttons so both stay tappable. */
        .import-bar {
          bottom: calc(var(--bottom-nav-h) + 8px);
          flex-wrap: wrap;
          gap: 10px;
          padding: 12px 14px;
        }
        .import-summary { flex: 1 1 100%; font-size: 0.85rem; }
        .import-bar .btn-secondary,
        .import-bar .btn-primary { flex: 1 1 0; height: 46px; }
      }
    `,
  ],
})
export class ImportComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  readonly expectedColumns = EXPECTED_COLUMNS;
  readonly columns = ['select', 'txn_date', 'description', 'amount', 'category', 'payment_type', 'planned'];

  readonly rows = signal<PreviewRow[]>([]);
  readonly fileName = signal('');
  readonly fileSize = signal('');
  readonly error = signal('');
  readonly importing = signal(false);
  readonly dragOver = signal(false);
  readonly filter = signal<ReviewFilter>('all');
  readonly search = signal('');

  year = new Date().getFullYear();

  private categoriesLoaded = false;
  private readonly categoryNames = new Set<string>();
  private readonly categoryClass = new Map<string, NeedClass>();

  constructor() {
    forkJoin({
      categories: this.api.listCategories(),
      paymentTypes: this.api.listPaymentTypes(),
    }).subscribe((r) => {
      for (const c of r.categories) {
        this.categoryNames.add(c.name.toLowerCase());
        this.categoryClass.set(c.name.toLowerCase(), c.need_class);
      }
      this.categoriesLoaded = true;
    });
  }

  readonly stepIndex = computed(() => (this.importing() ? 3 : this.rows().length ? 2 : 1));

  readonly plannedCount = computed(() => this.rows().filter((r) => r.planned).length);
  readonly unplannedCount = computed(() => this.rows().filter((r) => !r.planned).length);
  readonly reviewCount = computed(() => this.rows().filter((r) => r.reviewReason).length);
  readonly duplicateCount = computed(() => this.rows().filter((r) => r.duplicate).length);
  readonly totalAmount = computed(() => this.rows().reduce((sum, r) => sum + r.amount, 0));

  readonly filteredRows = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.rows().filter((r) => {
      if (this.filter() === 'planned' && !r.planned) return false;
      if (this.filter() === 'unplanned' && r.planned) return false;
      if (this.filter() === 'review' && !r.reviewReason) return false;
      if (this.filter() === 'duplicate' && !r.duplicate) return false;
      if (term && !r.description.toLowerCase().includes(term)) return false;
      return true;
    });
  });

  readonly selectedRows = computed(() => this.rows().filter((r) => r.selected));
  readonly selectedTotal = computed(() => this.selectedRows().reduce((sum, r) => sum + r.amount, 0));

  readonly allVisibleSelected = computed(() => {
    const visible = this.filteredRows();
    return visible.length > 0 && visible.every((r) => r.selected);
  });

  readonly dateRangeLabel = computed(() => {
    const dates = this.sortedDates();
    if (!dates.length) return '—';
    const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short' });
    return `${fmt(dates[0])}–${fmt(dates[dates.length - 1])}`;
  });

  readonly dateRangeYear = computed(() => {
    const dates = this.sortedDates();
    if (!dates.length) return '';
    const y1 = dates[0].slice(0, 4);
    const y2 = dates[dates.length - 1].slice(0, 4);
    return y1 === y2 ? y1 : `${y1}–${y2}`;
  });

  private sortedDates(): string[] {
    return this.rows()
      .map((r) => r.txn_date)
      .sort();
  }

  pillClass(category: string): string {
    const nc = this.categoryClass.get(category.toLowerCase());
    return nc ? `pill-${nc.toLowerCase()}` : 'pill-others';
  }

  paymentIcon(name?: string): string {
    if (!name) return 'account_balance_wallet';
    return PAYMENT_ICONS[name.trim().toLowerCase()] ?? 'account_balance_wallet';
  }

  formatCompact(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
    if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
    if (abs >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
    return `₹${n.toFixed(0)}`;
  }

  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.loadFile(file);
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave() {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.loadFile(file);
  }

  downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([this.expectedColumns]);
    XLSX.utils.book_append_sheet(wb, ws, 'Expense');
    XLSX.writeFile(wb, 'moneymap-template.xlsx');
  }

  toggleAll(event: MatCheckboxChange) {
    const checked = event.checked;
    const visible = new Set(this.filteredRows());
    this.rows.update((rs) => rs.map((r) => (visible.has(r) ? { ...r, selected: checked } : r)));
  }

  toggleRow(row: PreviewRow) {
    this.rows.update((rs) => rs.map((r) => (r === row ? { ...r, selected: !r.selected } : r)));
  }

  private async loadFile(file: File) {
    this.error.set('');
    this.fileName.set(file.name);
    this.fileSize.set(this.formatSize(file.size));

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const sheetName =
        wb.SheetNames.find((n) => n.toLowerCase().includes('expense')) ?? wb.SheetNames[0];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
      const parsed = json
        .map((r) => this.mapRow(r))
        .filter((r): r is PreviewRow => r !== null);
      if (parsed.length === 0) {
        this.error.set('No valid rows found. Check the column headers.');
      }
      this.rows.set(parsed);
      this.filter.set('all');
      this.search.set('');
      if (parsed.length) this.checkDuplicates(parsed);
    } catch {
      this.error.set('Could not read the file. Make sure it is a valid .xlsx.');
    }
  }

  /**
   * Asks the server which parsed rows already exist (or repeat within the
   * batch) and flags them: duplicates are marked and de-selected so they are
   * excluded from the import by default.
   */
  private checkDuplicates(parsed: PreviewRow[]) {
    const payload: ImportRow[] = parsed.map((r) => ({
      txn_date: r.txn_date,
      description: r.description,
      amount: r.amount,
    }));
    this.api.previewImport(payload).subscribe({
      next: (res) => {
        this.rows.update((rs) =>
          rs.map((r, i) =>
            res.flags[i]
              ? { ...r, duplicate: true, selected: false, reviewReason: 'duplicate' }
              : r,
          ),
        );
      },
      // Non-fatal: without the check, nothing is flagged and the server still
      // skips duplicates on import.
      error: () => undefined,
    });
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${Math.round(bytes / 1024)} KB`;
  }

  private mapRow(r: Record<string, unknown>): PreviewRow | null {
    const get = (...keys: string[]): unknown => {
      for (const k of Object.keys(r)) {
        if (keys.some((key) => k.trim().toLowerCase() === key.toLowerCase())) return r[k];
      }
      return undefined;
    };

    const rawDescription = String(get('Description', 'Desc') ?? '').trim();
    const description = rawDescription.replace(/\s+/g, ' ');
    const typoFixed = description.length > 0 && description !== rawDescription;
    const amountRaw = get('Amount', 'Amt');
    const amount = Number(amountRaw);
    if (!description || !isFinite(amount) || amount <= 0) return null;

    const date = this.resolveDate(get('Date'), get('Month'));
    if (!date) return null;

    const pup = String(get('PUP', 'Planned') ?? '').trim().toLowerCase();
    const category = this.str(get('Type', 'Category'));
    const paymentType = this.str(get('Payment Type', 'PaymentType', 'Payment'));

    const newCategory =
      this.categoriesLoaded && !!category && !this.categoryNames.has(category.toLowerCase());
    const reviewReason = typoFixed ? 'typo fixed' : newCategory ? 'new category' : null;

    return {
      txn_date: date,
      description,
      amount,
      category,
      payment_type: paymentType,
      planned: pup.startsWith('plan'),
      selected: true,
      newCategory,
      duplicate: false,
      reviewReason,
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
    const payload: ImportRow[] = this.selectedRows().map((r) => ({
      txn_date: r.txn_date,
      description: r.description,
      amount: r.amount,
      category: r.category,
      payment_type: r.payment_type,
      planned: r.planned,
    }));
    if (!payload.length) return;

    this.importing.set(true);
    this.api.importTransactions(payload).subscribe({
      next: (res) => {
        this.importing.set(false);
        const msg = res.skipped
          ? `Imported ${res.inserted} · skipped ${res.skipped} duplicate${res.skipped === 1 ? '' : 's'}`
          : `Imported ${res.inserted} transactions`;
        this.snack.open(msg, 'OK', { duration: 4000 });
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
    this.fileSize.set('');
    this.error.set('');
    this.filter.set('all');
    this.search.set('');
  }
}
