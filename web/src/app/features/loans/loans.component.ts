import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { Loan, LoanScheduleRow } from '../../core/models';

@Component({
  selector: 'app-loans',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="page">
      <div class="page-header"><h1>Loans / EMI</h1></div>

      <div class="grid">
        <div>
          <mat-card>
            <mat-card-content>
              <div class="card-head">
                <div class="card-title">Your loans</div>
                <span class="spacer"></span>
                <span class="count-badge">{{ loans().length }}</span>
              </div>

              @if (loans().length === 0) {
                <p class="empty">No loans yet.</p>
              }
              @for (l of loans(); track l.id) {
                <button
                  type="button"
                  class="loan-item"
                  [class.active]="selected()?.id === l.id"
                  (click)="select(l)"
                >
                  <span class="loan-icon"><mat-icon>{{ loanIcon(l.name) }}</mat-icon></span>
                  <span class="loan-info">
                    <span class="loan-name">{{ l.name }}</span>
                    <span class="loan-sub">
                      {{ l.principal | currency: 'INR' : 'symbol' : '1.0-0' }} &middot;
                      {{ loanPercentPaid(l) }}% paid
                    </span>
                    <span class="loan-bar"><span class="loan-bar-fill" [style.width.%]="loanPercentPaid(l)"></span></span>
                  </span>
                  <span class="icon-btn" (click)="remove(l, $event)"><mat-icon>delete</mat-icon></span>
                </button>
              }
            </mat-card-content>
          </mat-card>

          <mat-card class="mt">
            <mat-card-content>
              <div class="card-head">
                <div>
                  <div class="card-title">{{ editingLoan() ? 'Edit loan' : 'Add loan' }}</div>
                  <div class="card-subtitle">EMI is auto-computed from your inputs.</div>
                </div>
              </div>

              <div class="add-box">
                <div class="field">
                  <label class="field-label">Name</label>
                  <input class="plain-input" placeholder="e.g. Home Loan" [(ngModel)]="formName" />
                </div>
                <div class="field-row">
                  <div class="field">
                    <label class="field-label">Principal (&#8377;)</label>
                    <input class="plain-input" type="number" placeholder="0" [(ngModel)]="formPrincipal" />
                  </div>
                  <div class="field">
                    <label class="field-label">Rate (% p.a.)</label>
                    <input class="plain-input" type="number" placeholder="0" [(ngModel)]="formRate" />
                  </div>
                </div>
                <div class="field">
                  <label class="field-label">Tenure (months)</label>
                  <input class="plain-input" type="number" placeholder="0" [(ngModel)]="formTenure" />
                </div>
                <button class="action-btn full-width" (click)="saveLoan()" [disabled]="!canSave()">
                  <mat-icon>{{ editingLoan() ? 'save' : 'add' }}</mat-icon>
                  {{ editingLoan() ? 'Save changes' : 'Add loan' }}
                </button>
                @if (editingLoan()) {
                  <button class="link-btn full-width" (click)="cancelEdit()">Cancel</button>
                }
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <div>
          @if (!selected()) {
            <mat-card>
              <mat-card-content><p class="empty">Select or add a loan to see its details.</p></mat-card-content>
            </mat-card>
          } @else {
            <mat-card>
              <mat-card-content>
                <div class="detail-head">
                  <span class="detail-icon"><mat-icon>{{ loanIcon(selected()!.name) }}</mat-icon></span>
                  <div>
                    <div class="detail-title">{{ selected()!.name }}</div>
                    <div class="detail-sub">
                      {{ selected()!.annual_rate ?? 0 }}% p.a. &middot;
                      {{ totalInstallments() }} installments &middot;
                      started {{ selected()!.start_date | date: 'MMM yyyy' }}
                    </div>
                  </div>
                  <span class="spacer"></span>
                  <button class="ghost-btn" (click)="exportCsv()">Export</button>
                  <button class="ghost-btn" (click)="startEdit()">Edit</button>
                </div>
              </mat-card-content>
            </mat-card>

            <div class="summary-panel">
              <div class="summary-top">
                <div>
                  <div class="summary-percent">{{ percentPaid() }}%</div>
                  <div class="summary-label">paid off</div>
                </div>
                <div class="summary-stats">
                  <div class="summary-stat">
                    <div class="summary-stat-label">Monthly EMI</div>
                    <div class="summary-stat-value">{{ monthlyEmi() | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
                  </div>
                  <div class="summary-stat">
                    <div class="summary-stat-label">Installments left</div>
                    <div class="summary-stat-value">{{ installmentsLeft() }}</div>
                  </div>
                </div>
              </div>
              <div class="summary-bar"><div class="summary-bar-fill" [style.width.%]="percentPaid()"></div></div>
              <div class="summary-amounts">
                <span>{{ paidAmount() | currency: 'INR' : 'symbol' : '1.0-0' }} paid</span>
                <span>{{ leftAmount() | currency: 'INR' : 'symbol' : '1.0-0' }} left</span>
              </div>
            </div>

            <div class="mini-stats">
              <div class="mini-stat-card">
                <div class="mini-stat-label">Total interest</div>
                <div class="mini-stat-value">{{ totalInterest() | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
              </div>
              <div class="mini-stat-card">
                <div class="mini-stat-label">Payoff date</div>
                <div class="mini-stat-value">{{ payoffDate() ? (payoffDate() | date: 'MMM yyyy') : '—' }}</div>
              </div>
              @if (nextDue(); as due) {
                <div class="mini-stat-card next-due">
                  <div class="next-due-info">
                    <div class="mini-stat-label"><mat-icon>schedule</mat-icon> Next payment due</div>
                    <div class="mini-stat-value">{{ due.emi | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
                    <div class="mini-stat-sub">{{ due.due_date | date: 'MMM yyyy' }} &middot; installment {{ due.period }}</div>
                  </div>
                  <button class="action-btn" (click)="payNext()">Pay now</button>
                </div>
              } @else {
                <div class="mini-stat-card next-due done">
                  <div class="mini-stat-label"><mat-icon>check_circle</mat-icon> All paid off</div>
                </div>
              }
            </div>

            <mat-card>
              <mat-card-content>
                <div class="card-head">
                  <div class="card-title">Amortization schedule</div>
                  <span class="spacer"></span>
                  <div class="legend">
                    <span class="legend-dot paid"></span>Paid
                    <span class="legend-dot due"></span>Due
                  </div>
                </div>

                <!-- Six money columns per period: genuinely tabular, so on a
                     phone this scrolls sideways rather than stacking into
                     dozens of tall cards. -->
                <div class="scroll-x">
                <table mat-table [dataSource]="schedule()" class="full-width">
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>#</th>
                    <td mat-cell *matCellDef="let r">
                      @if (r.paid) {
                        <span class="row-badge paid"><mat-icon>check</mat-icon></span>
                      } @else if (nextDue()?.id === r.id) {
                        <span class="row-badge due">{{ r.period }}</span>
                      } @else {
                        <span class="row-badge">{{ r.period }}</span>
                      }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="due_date">
                    <th mat-header-cell *matHeaderCellDef>Due</th>
                    <td mat-cell *matCellDef="let r">{{ r.due_date | date: 'MMM yyyy' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="emi">
                    <th mat-header-cell *matHeaderCellDef class="text-right">EMI</th>
                    <td mat-cell *matCellDef="let r" class="text-right">{{ r.emi | currency: 'INR' : 'symbol' : '1.0-0' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="interest">
                    <th mat-header-cell *matHeaderCellDef class="text-right">Interest</th>
                    <td mat-cell *matCellDef="let r" class="text-right amt-interest">{{ r.interest | currency: 'INR' : 'symbol' : '1.0-0' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="principal_paid">
                    <th mat-header-cell *matHeaderCellDef class="text-right">Principal</th>
                    <td mat-cell *matCellDef="let r" class="text-right amt-principal">{{ r.principal_paid | currency: 'INR' : 'symbol' : '1.0-0' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="balance">
                    <th mat-header-cell *matHeaderCellDef class="text-right">Balance</th>
                    <td mat-cell *matCellDef="let r" class="text-right">{{ r.balance | currency: 'INR' : 'symbol' : '1.0-0' }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="scheduleColumns"></tr>
                  <tr
                    mat-row
                    *matRowDef="let row; columns: scheduleColumns"
                    [class.row-due]="nextDue()?.id === row.id"
                  ></tr>
                </table>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .grid { display: grid; grid-template-columns: 360px 1fr; gap: 16px; align-items: start; }
      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
      .mt { margin-top: 16px; }
      .empty { opacity: 0.6; padding: 16px; }

      .card-head { display: flex; align-items: center; margin-bottom: 14px; }
      .card-title { font-weight: 700; font-size: 1.05rem; }
      .card-subtitle { font-size: 0.85rem; color: var(--mat-sys-on-surface-variant); margin-top: 2px; }

      .count-badge {
        display: grid;
        place-items: center;
        min-width: 24px;
        height: 24px;
        padding: 0 6px;
        border-radius: 999px;
        background: var(--surface-2);
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.78rem;
        font-weight: 700;
      }

      /* ---- Loan list rows ---- */
      .loan-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        box-sizing: border-box;
        padding: 12px;
        margin-bottom: 8px;
        border-radius: 12px;
        border: 1px solid transparent;
        background: transparent;
        cursor: pointer;
        text-align: left;
        font-family: inherit;
        color: inherit;
        transition: background 150ms ease, border-color 150ms ease;
      }
      .loan-item:last-child { margin-bottom: 0; }
      .loan-item:hover { background: var(--hover-bg); }
      .loan-item.active {
        background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent);
        border-color: color-mix(in srgb, var(--mat-sys-primary) 35%, transparent);
      }
      .loan-icon {
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: color-mix(in srgb, var(--mat-sys-primary) 16%, transparent);
        color: var(--accent-ink);

        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
      .loan-info { display: flex; flex-direction: column; gap: 4px; flex: 1 1 auto; min-width: 0; }
      .loan-name { font-weight: 600; font-size: 0.92rem; }
      .loan-sub { font-size: 0.78rem; color: var(--mat-sys-on-surface-variant); }
      .loan-bar {
        display: block;
        height: 5px;
        border-radius: 999px;
        background: var(--hairline);
        overflow: hidden;
        margin-top: 2px;
      }
      .loan-bar-fill {
        display: block;
        height: 100%;
        border-radius: 999px;
        background: var(--accent-grad);
      }
      .icon-btn {
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        color: var(--mat-sys-on-surface-variant);
        cursor: pointer;

        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
      .icon-btn:hover { background: light-dark(#fde8e8, #3a2020); color: var(--danger); }

      /* ---- Add / edit loan form ---- */
      .add-box {
        background: var(--hover-bg);
        border-radius: 14px;
        padding: 18px;
        box-sizing: border-box;
      }
      .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
      .field:last-of-type { margin-bottom: 0; }
      .field-row { display: flex; gap: 12px; }
      .field-row .field { flex: 1 1 0; }
      .field-label { font-size: 0.85rem; font-weight: 600; color: var(--mat-sys-on-surface-variant); }
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
      .plain-input::placeholder { color: var(--ink-faint); }
      .plain-input:focus { border-color: var(--mat-sys-primary); }

      .action-btn {
        background: var(--accent-grad);
        color: var(--on-accent);
        border: none;
        border-radius: 10px;
        padding: 0 20px;
        height: 44px;
        font-weight: 600;
        font-size: 0.92rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        white-space: nowrap;
        box-shadow: 0 4px 14px oklch(0.6 0.15 168 / 0.35), 0 6px 14px rgba(16, 185, 129, 0.35);
        transition: transform 90ms ease, box-shadow 90ms ease;
      }
      .action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .action-btn:active { transform: translateY(3px); box-shadow: 0 1px 6px oklch(0.6 0.15 168 / 0.3), 0 2px 6px rgba(16, 185, 129, 0.3); }
      .action-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
      .action-btn.full-width { width: 100%; margin-top: 4px; }

      .link-btn {
        background: none;
        border: none;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.85rem;
        cursor: pointer;
        padding: 8px 0 0;
        text-decoration: underline;
      }
      .link-btn.full-width { width: 100%; text-align: center; }

      .ghost-btn {
        height: 36px;
        padding: 0 16px;
        border-radius: 10px;
        border: 1px solid var(--field-border);
        background: var(--field-bg);
        color: inherit;
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
        margin-left: 8px;
      }
      .ghost-btn:hover { border-color: var(--mat-sys-primary); }

      /* ---- Detail header ---- */
      .detail-head { display: flex; align-items: center; gap: 14px; }
      .detail-icon {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: color-mix(in srgb, var(--mat-sys-primary) 16%, transparent);
        color: var(--accent-ink);
        flex: 0 0 auto;
      }
      .detail-title { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 1.2rem; }
      .detail-sub { font-size: 0.85rem; color: var(--mat-sys-on-surface-variant); margin-top: 2px; }

      /* ---- Summary panel ---- */
      .summary-panel {
        background: var(--accent-grad-deep);
        border-radius: 16px;
        padding: 24px;
        color: #ffffff;
        margin: 16px 0;
        box-shadow: 0 12px 28px rgba(5, 150, 105, 0.35);
      }
      .summary-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
      .summary-percent { font-family: 'Inter', sans-serif; font-size: 2.4rem; font-weight: 800; line-height: 1; }
      .summary-label { font-size: 0.95rem; opacity: 0.9; margin-top: 2px; }
      .summary-stats { display: flex; gap: 32px; }
      .summary-stat-label { font-size: 0.8rem; opacity: 0.85; }
      .summary-stat-value { font-family: 'Inter', sans-serif; font-size: 1.3rem; font-weight: 700; margin-top: 4px; }
      .summary-bar {
        height: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.28);
        overflow: hidden;
        margin: 18px 0 10px;
      }
      .summary-bar-fill { display: block; height: 100%; border-radius: 999px; background: #ffffff; }
      .summary-amounts { display: flex; justify-content: space-between; font-size: 0.85rem; opacity: 0.95; }

      /* ---- Mini stat cards ---- */
      .mini-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }
      .mini-stat-card {
        background: var(--surface-2);
        border: 1px solid var(--hairline);
        border-radius: 14px;
        padding: 16px 18px;
        box-sizing: border-box;
      }
      .mini-stat-label {
        font-size: 0.8rem;
        color: var(--mat-sys-on-surface-variant);
        display: flex;
        align-items: center;
        gap: 6px;

        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
      .mini-stat-value { font-family: 'Inter', sans-serif; font-size: 1.3rem; font-weight: 700; margin-top: 6px; }
      .mini-stat-sub { font-size: 0.78rem; color: var(--mat-sys-on-surface-variant); margin-top: 2px; }
      .mini-stat-card.next-due {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: color-mix(in srgb, var(--mat-sys-primary) 10%, transparent);
        border-color: color-mix(in srgb, var(--mat-sys-primary) 30%, transparent);
      }
      .mini-stat-card.next-due .mini-stat-label { color: var(--accent-ink); font-weight: 600; }
      .mini-stat-card.next-due.done { justify-content: flex-start; }
      .mini-stat-card.next-due .action-btn { height: 36px; padding: 0 16px; font-size: 0.85rem; }

      /* ---- Amortization table ---- */
      .legend {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        color: var(--mat-sys-on-surface-variant);
      }
      .legend-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-left: 10px;
      }
      .legend-dot:first-child { margin-left: 0; }
      .legend-dot.paid { background: var(--accent-ink); }
      .legend-dot.due { background: #f59e0b; }

      .row-badge {
        display: inline-grid;
        place-items: center;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        font-size: 0.75rem;
        font-weight: 700;
        background: var(--surface-2);
        color: var(--mat-sys-on-surface-variant);

        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
      .row-badge.paid { background: var(--accent); color: var(--on-accent); }
      .row-badge.due { background: #f59e0b; color: #ffffff; }

      .amt-interest { color: #b45309; }
      .amt-principal { color: var(--accent-ink); }

      .mat-mdc-header-cell { text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.04em; }
      tr.row-due { background: color-mix(in srgb, #f59e0b 10%, transparent); }

      /* ---- Phone ---- */
      @media (max-width: 700px) {
        .grid, .mini-stats { gap: 12px; }

        .summary-panel { padding: 18px; }
        .summary-top { flex-direction: column; gap: 12px; }
        .summary-percent { font-size: 2rem; }
        .summary-stats { gap: 24px; }
        .summary-stat-value { font-size: 1.1rem; }

        .detail-head { gap: 10px; }
        .detail-title { font-size: 1.05rem; }
        .mini-stat-value { font-size: 1.15rem; }

        .field-row { flex-direction: column; gap: 0; }
        .plain-input { height: 48px; font-size: 16px; }
        .action-btn { height: 48px; }

        /* Let the schedule use the card's full width for its sideways scroll. */
        .scroll-x {
          margin-inline: -16px;
          padding-inline: 16px;
        }
        .scroll-x .mat-mdc-cell,
        .scroll-x .mat-mdc-header-cell {
          padding: 10px 10px;
          white-space: nowrap;
        }
      }
    `,
  ],
})
export class LoansComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  readonly scheduleColumns = ['status', 'due_date', 'emi', 'interest', 'principal_paid', 'balance'];
  readonly loans = signal<Loan[]>([]);
  readonly selected = signal<Loan | null>(null);
  readonly editingLoan = signal<Loan | null>(null);

  readonly schedule = computed<LoanScheduleRow[]>(() => this.selected()?.schedule ?? []);
  readonly totalInstallments = computed(() => this.schedule().length);
  readonly paidCount = computed(() => this.schedule().filter((r) => r.paid).length);
  readonly percentPaid = computed(() =>
    this.totalInstallments() ? Math.round((this.paidCount() / this.totalInstallments()) * 100) : 0,
  );
  readonly paidAmount = computed(() =>
    this.schedule().filter((r) => r.paid).reduce((sum, r) => sum + Number(r.emi), 0),
  );
  readonly leftAmount = computed(() =>
    this.schedule().filter((r) => !r.paid).reduce((sum, r) => sum + Number(r.emi), 0),
  );
  readonly monthlyEmi = computed(() => this.schedule()[0]?.emi ?? this.selected()?.emi_amount ?? 0);
  readonly installmentsLeft = computed(() => this.totalInstallments() - this.paidCount());
  readonly totalInterest = computed(() => this.schedule().reduce((sum, r) => sum + Number(r.interest), 0));
  readonly payoffDate = computed(() => this.schedule().at(-1)?.due_date ?? null);
  readonly nextDue = computed<LoanScheduleRow | null>(() => this.schedule().find((r) => !r.paid) ?? null);

  formName = '';
  formPrincipal: number | null = null;
  formRate: number | null = null;
  formTenure: number | null = null;

  constructor() {
    this.loadLoans();
  }

  private loadLoans(selectId?: string) {
    this.api.listLoans().subscribe((list) => {
      if (!list.length) {
        this.loans.set([]);
        this.selected.set(null);
        return;
      }
      forkJoin(list.map((l) => this.api.getLoan(l.id))).subscribe((full) => {
        this.loans.set(full);
        const wantId = selectId ?? this.selected()?.id;
        this.selected.set(full.find((l) => l.id === wantId) ?? full[0]);
      });
    });
  }

  select(loan: Loan) {
    this.selected.set(loan);
  }

  loanIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('car') || n.includes('vehicle') || n.includes('auto')) return 'directions_car';
    if (n.includes('home') || n.includes('house') || n.includes('mortgage')) return 'home';
    if (n.includes('personal') || n.includes('credit')) return 'credit_card';
    if (n.includes('education') || n.includes('student')) return 'school';
    return 'account_balance';
  }

  loanPercentPaid(l: Loan): number {
    const sched = l.schedule ?? [];
    if (!sched.length) return 0;
    return Math.round((sched.filter((r) => r.paid).length / sched.length) * 100);
  }

  canSave(): boolean {
    return !!this.formName && Number(this.formPrincipal) > 0 && Number(this.formTenure) > 0;
  }

  private calcEmi(principal: number, annualRatePct: number, months: number): number {
    if (months <= 0) return 0;
    const r = annualRatePct / 12 / 100;
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    if (r === 0) return round2(principal / months);
    const factor = Math.pow(1 + r, months);
    return round2((principal * r * factor) / (factor - 1));
  }

  startEdit() {
    const l = this.selected();
    if (!l) return;
    this.editingLoan.set(l);
    this.formName = l.name;
    this.formPrincipal = l.principal;
    this.formRate = l.annual_rate ?? 0;
    this.formTenure = l.schedule?.length ?? 0;
  }

  cancelEdit() {
    this.resetForm();
  }

  private resetForm() {
    this.formName = '';
    this.formPrincipal = null;
    this.formRate = null;
    this.formTenure = null;
    this.editingLoan.set(null);
  }

  saveLoan() {
    if (!this.canSave()) return;
    const principal = Number(this.formPrincipal);
    const rate = Number(this.formRate ?? 0);
    const months = Number(this.formTenure);
    const emi = this.calcEmi(principal, rate, months);
    const editing = this.editingLoan();
    const startDate = editing?.start_date ?? new Date().toISOString().slice(0, 10);

    const body = {
      name: this.formName,
      principal,
      annual_rate: rate,
      emi_amount: emi,
      start_date: startDate,
    };

    const req = editing ? this.api.updateLoan(editing.id, body) : this.api.createLoan(body);
    req.subscribe({
      next: (loan) => {
        this.snack.open(editing ? 'Loan updated' : 'Loan added', 'OK', { duration: 2000 });
        this.resetForm();
        this.loadLoans(loan.id);
      },
      error: (err) => this.snack.open(err?.error?.message ?? 'Failed', 'OK', { duration: 4000 }),
    });
  }

  remove(loan: Loan, event: Event) {
    event.stopPropagation();
    if (!confirm(`Delete loan "${loan.name}"?`)) return;
    this.api.deleteLoan(loan.id).subscribe(() => {
      if (this.selected()?.id === loan.id) this.selected.set(null);
      if (this.editingLoan()?.id === loan.id) this.resetForm();
      this.loadLoans();
    });
  }

  payNext() {
    const loan = this.selected();
    const due = this.nextDue();
    if (!loan || !due) return;
    this.api.setInstallmentPaid(due.id, true).subscribe({
      next: () => {
        this.snack.open('Payment recorded', 'OK', { duration: 2000 });
        this.loadLoans(loan.id);
      },
      error: () => this.snack.open('Failed to record payment', 'OK', { duration: 3000 }),
    });
  }

  exportCsv() {
    const loan = this.selected();
    if (!loan?.schedule?.length) return;
    const header = ['#', 'Due', 'EMI', 'Interest', 'Principal', 'Balance', 'Paid'];
    const rows = loan.schedule.map((r) => [
      r.period,
      r.due_date,
      r.emi,
      r.interest,
      r.principal_paid,
      r.balance,
      r.paid ? 'Yes' : 'No',
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${loan.name.replace(/\s+/g, '_')}_schedule.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
