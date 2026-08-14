import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { NotificationService } from '../../core/notification.service';
import {
  AccountBalance,
  CardEmiPlan,
  CardStatement,
  CardStatementDetail,
  CreditCard,
  StatementStatus,
  Transaction,
} from '../../core/models';

const STATUS_META: Record<StatementStatus, { label: string; cls: string }> = {
  unpaid: { label: 'Unpaid', cls: 'is-unpaid' },
  partially_paid: { label: 'Part paid', cls: 'is-partial' },
  paid: { label: 'Paid', cls: 'is-paid' },
  carried: { label: 'Carried over', cls: 'is-carried' },
};

@Component({
  selector: 'app-credit-cards',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Credit Cards</h1>
          <p class="page-subtitle">
            Card spends stay off your bank until you pay the bill
          </p>
        </div>
        <span class="spacer"></span>
        <div class="headline">
          <div class="headline-label">BILLS DUE</div>
          <div class="headline-value" [class.neg]="totalDue() > 0">
            {{ totalDue() | currency: 'INR' : 'symbol' : '1.0-0' }}
          </div>
        </div>
      </div>

      @if (cards().length) {
        <div class="card-grid">
          @for (c of cards(); track c.account_id) {
            <mat-card
              class="cc-card"
              [class.selected]="selectedId() === c.account_id"
              (click)="select(c.account_id)"
            >
              <mat-card-content>
                <div class="cc-top">
                  <span class="cc-icon"><mat-icon>credit_card</mat-icon></span>
                  <span class="cc-name">{{ c.account?.name }}</span>
                  <span class="spacer"></span>
                  @if (c.due_total > 0) {
                    <span class="pill due">Due</span>
                  }
                </div>

                <div class="cc-outstanding">
                  {{ c.outstanding | currency: 'INR' : 'symbol' : '1.0-0' }}
                </div>
                <div class="cc-caption">outstanding</div>

                @if (c.credit_limit > 0) {
                  <div class="meter" [class.hot]="(c.utilisation_pct ?? 0) >= c.utilisation_alert_pct">
                    <span [style.width.%]="barWidth(c)"></span>
                  </div>
                  <div class="cc-caption">
                    {{ c.utilisation_pct }}% of
                    {{ c.credit_limit | currency: 'INR' : 'symbol' : '1.0-0' }} ·
                    {{ c.available | currency: 'INR' : 'symbol' : '1.0-0' }} left
                  </div>
                }

                <div class="cc-foot">
                  @if (c.next_due_date) {
                    <mat-icon class="foot-icon">event</mat-icon>
                    <span>
                      {{ c.due_total | currency: 'INR' : 'symbol' : '1.0-0' }}
                      due {{ c.next_due_date | date: 'dd MMM' }}
                    </span>
                  } @else {
                    <mat-icon class="foot-icon">check_circle</mat-icon>
                    <span>No bill pending · bills on day {{ c.statement_day }}</span>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }

      @if (setupCandidates().length) {
        <mat-card class="panel">
          <mat-card-content>
            <div class="card-title">Set up card billing</div>
            <p class="hint">
              Pick a credit card account and tell us its cycle. Bills generate
              on their own once the statement day passes.
            </p>
            <div class="form-row">
              <mat-select class="field select" [(ngModel)]="newAccountId" placeholder="Card account" panelWidth="">
                @for (a of setupCandidates(); track a.id) {
                  <mat-option [value]="a.id">{{ a.name }}</mat-option>
                }
              </mat-select>
              <label class="field-wrap">
                <span class="field-label">Bills on day</span>
                <input class="field num" type="number" min="1" max="31" [(ngModel)]="newStatementDay" />
              </label>
              <label class="field-wrap">
                <span class="field-label">Due after (days)</span>
                <input class="field num" type="number" min="1" max="60" [(ngModel)]="newDueDays" />
              </label>
              <label class="field-wrap">
                <span class="field-label">Credit limit</span>
                <input class="field num wide" type="number" min="0" [(ngModel)]="newLimit" />
              </label>
              <mat-select class="field select" [(ngModel)]="newPayFrom" placeholder="Pay from" panelWidth="">
                @for (a of payAccounts(); track a.id) {
                  <mat-option [value]="a.id">{{ a.name }}</mat-option>
                }
              </mat-select>
              <button class="action-btn" (click)="setUpCard()" [disabled]="!newAccountId">
                <mat-icon>add</mat-icon> Enable
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      } @else if (!cards().length) {
        <mat-card class="panel">
          <mat-card-content>
            <div class="card-title">No credit cards yet</div>
            <p class="hint">
              Add an account of type <strong>Credit Card</strong> on the
              Accounts page first, then come back to set up its billing cycle.
            </p>
          </mat-card-content>
        </mat-card>
      }

      @if (selected(); as card) {
        <mat-card class="panel">
          <mat-card-content>
            <div class="detail-head">
              <div class="card-title">{{ card.account?.name }}</div>
              <span class="spacer"></span>
              <div class="tabs">
                <button [class.on]="tab() === 'bills'" (click)="tab.set('bills')">Bills</button>
                <button [class.on]="tab() === 'emi'" (click)="tab.set('emi')">EMI</button>
                <button [class.on]="tab() === 'settings'" (click)="tab.set('settings')">Settings</button>
              </div>
            </div>

            <!-- ------------------------------------------------ BILLS -->
            @if (tab() === 'bills') {
              @if (!statements().length) {
                <p class="hint">
                  No bills yet. The first one generates on day
                  {{ card.statement_day }} and will sweep up everything spent
                  on this card so far.
                </p>
              }
              @for (s of statements(); track s.id) {
                <div class="stmt" [class.open]="detail()?.id === s.id">
                  <div class="stmt-row" (click)="toggle(s)">
                    <div class="stmt-main">
                      <div class="stmt-date">
                        {{ s.statement_date | date: 'dd MMM yyyy' }}
                      </div>
                      <div class="stmt-sub">
                        due {{ s.due_date | date: 'dd MMM yyyy' }}
                        @if (s.carried_over > 0) {
                          · incl. {{ s.carried_over | currency: 'INR' : 'symbol' : '1.0-0' }} carried
                        }
                      </div>
                    </div>
                    <div class="stmt-amounts">
                      <div class="stmt-total">
                        {{ s.total_amount | currency: 'INR' : 'symbol' : '1.0-0' }}
                      </div>
                      @if (s.paid_amount > 0 && s.status !== 'paid') {
                        <div class="stmt-sub">
                          {{ s.paid_amount | currency: 'INR' : 'symbol' : '1.0-0' }} paid
                        </div>
                      }
                    </div>
                    <span class="pill" [class]="statusClass(s)">{{ statusLabel(s) }}</span>
                    <mat-icon class="chev">
                      {{ detail()?.id === s.id ? 'expand_less' : 'expand_more' }}
                    </mat-icon>
                  </div>

                  @if (detail()?.id === s.id) {
                    <div class="stmt-body">
                      <div class="mini-row">
                        <span>Minimum due</span>
                        <strong>{{ s.minimum_due | currency: 'INR' : 'symbol' : '1.0-0' }}</strong>
                      </div>
                      <div class="mini-row">
                        <span>App calculated</span>
                        <strong>{{ s.computed_amount | currency: 'INR' : 'symbol' : '1.0-0' }}</strong>
                      </div>

                      @if (detail()!.transactions.length) {
                        <div class="sub-title">On this bill</div>
                        <div class="lines">
                          @for (t of detail()!.transactions; track t.id) {
                            <div class="line" [class.credit]="t.direction !== 'expense'">
                              <span class="line-date">{{ t.txn_date | date: 'dd MMM' }}</span>
                              <span class="line-desc">{{ t.description }}</span>
                              <span class="line-amt">
                                {{ t.direction === 'expense' ? '' : '−'
                                }}{{ t.amount | currency: 'INR' : 'symbol' : '1.0-0' }}
                              </span>
                            </div>
                          }
                        </div>
                      }

                      @if (detail()!.installments.length) {
                        <div class="sub-title">EMI installments</div>
                        <div class="lines">
                          @for (i of detail()!.installments; track i.id) {
                            <div class="line">
                              <span class="line-date">{{ i.period }}/{{ i.plan?.tenure_months }}</span>
                              <span class="line-desc">{{ i.plan?.description }}</span>
                              <span class="line-amt">
                                {{ i.emi | currency: 'INR' : 'symbol' : '1.0-0' }}
                              </span>
                            </div>
                          }
                        </div>
                      }

                      <div class="sub-title">Correct the total</div>
                      <div class="form-row tight">
                        <label class="field-wrap">
                          <span class="field-label">Bank's figure</span>
                          <input class="field num wide" type="number" min="0" [(ngModel)]="editTotal" />
                        </label>
                        <button class="ghost-btn" (click)="saveTotal(s)">Save</button>
                      </div>

                      @if (s.status !== 'paid' && s.status !== 'carried') {
                        <div class="sub-title">Pay this bill</div>
                        <div class="form-row tight">
                          <label class="field-wrap">
                            <span class="field-label">Amount</span>
                            <input class="field num wide" type="number" min="0" [(ngModel)]="payAmount" />
                          </label>
                          <mat-select class="field select" [(ngModel)]="payFrom" placeholder="From account" panelWidth="">
                            @for (a of payAccounts(); track a.id) {
                              <mat-option [value]="a.id">{{ a.name }}</mat-option>
                            }
                          </mat-select>
                          <button class="ghost-btn" (click)="payAmount = s.minimum_due">Minimum</button>
                          <button class="ghost-btn" (click)="payAmount = remaining(s)">Full</button>
                          <button class="action-btn" (click)="pay(s)" [disabled]="!payAmount || payAmount <= 0">
                            <mat-icon>payments</mat-icon> Mark paid
                          </button>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            }

            <!-- -------------------------------------------------- EMI -->
            @if (tab() === 'emi') {
              <p class="hint">
                Converting a purchase keeps it on the card — you still owe all
                of it — but bills it in monthly installments instead of one hit.
                Only purchases not yet on a bill can be converted.
              </p>

              <div class="form-row">
                <mat-select class="field select grow" [(ngModel)]="emiTxnId" placeholder="Purchase to convert" panelWidth="">
                  @for (t of unbilled(); track t.id) {
                    <mat-option [value]="t.id">
                      {{ t.txn_date | date: 'dd MMM' }} · {{ t.description }} ·
                      {{ t.amount | currency: 'INR' : 'symbol' : '1.0-0' }}
                    </mat-option>
                  }
                </mat-select>
                <label class="field-wrap">
                  <span class="field-label">Months</span>
                  <input class="field num" type="number" min="1" max="120" [(ngModel)]="emiTenure" />
                </label>
                <label class="field-wrap">
                  <span class="field-label">Rate % p.a.</span>
                  <input class="field num" type="number" min="0" [(ngModel)]="emiRate" />
                </label>
                <label class="field-wrap">
                  <span class="field-label">Processing fee</span>
                  <input class="field num" type="number" min="0" [(ngModel)]="emiFee" />
                </label>
                <button class="action-btn" (click)="convertToEmi()" [disabled]="!emiTxnId">
                  <mat-icon>splitscreen</mat-icon> Convert
                </button>
              </div>

              @if (!unbilled().length) {
                <p class="hint">Nothing unbilled on this card to convert right now.</p>
              }

              @for (p of emiPlans(); track p.id) {
                <div class="plan">
                  <div class="plan-head">
                    <div>
                      <div class="plan-name">{{ p.description }}</div>
                      <div class="stmt-sub">
                        {{ p.principal | currency: 'INR' : 'symbol' : '1.0-0' }} over
                        {{ p.tenure_months }} months at {{ p.annual_rate }}% ·
                        {{ p.emi_amount | currency: 'INR' : 'symbol' : '1.0-0' }}/mo
                      </div>
                    </div>
                    <span class="spacer"></span>
                    <span class="pill" [class.is-paid]="!p.is_active">
                      {{ billedCount(p) }}/{{ p.tenure_months }} billed
                    </span>
                    @if (billedCount(p) === 0) {
                      <button matIconButton (click)="cancelEmi(p)" aria-label="Cancel plan">
                        <mat-icon>delete</mat-icon>
                      </button>
                    }
                  </div>
                </div>
              }
            }

            <!-- --------------------------------------------- SETTINGS -->
            @if (tab() === 'settings') {
              <div class="form-row">
                <label class="field-wrap">
                  <span class="field-label">Bills on day</span>
                  <input class="field num" type="number" min="1" max="31" [(ngModel)]="editStatementDay" />
                </label>
                <label class="field-wrap">
                  <span class="field-label">Due after (days)</span>
                  <input class="field num" type="number" min="1" max="60" [(ngModel)]="editDueDays" />
                </label>
                <label class="field-wrap">
                  <span class="field-label">Credit limit</span>
                  <input class="field num wide" type="number" min="0" [(ngModel)]="editLimit" />
                </label>
                <label class="field-wrap">
                  <span class="field-label">Min due %</span>
                  <input class="field num" type="number" min="0" max="100" [(ngModel)]="editMinPct" />
                </label>
              </div>
              <div class="form-row">
                <mat-select class="field select" [(ngModel)]="editPayFrom" placeholder="Default pay from" panelWidth="">
                  @for (a of payAccounts(); track a.id) {
                    <mat-option [value]="a.id">{{ a.name }}</mat-option>
                  }
                </mat-select>
                <label class="field-wrap">
                  <span class="field-label">Warn at % used</span>
                  <input class="field num" type="number" min="1" max="100" [(ngModel)]="editAlertPct" />
                </label>
                <label class="field-wrap">
                  <span class="field-label">Remind days before</span>
                  <input class="field num" type="number" min="0" max="30" [(ngModel)]="editRemindDays" />
                </label>
                <button class="action-btn" (click)="saveSettings(card)">
                  <mat-icon>save</mat-icon> Save
                </button>
                <button class="ghost-btn danger" (click)="disable(card)">Stop billing</button>
              </div>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      .page-subtitle { margin: 4px 0 0; font-size: 0.9rem; color: var(--mat-sys-on-surface-variant); }
      .headline { text-align: right; }
      .headline-label {
        font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }
      .headline-value {
        font-family: 'Inter', sans-serif; font-weight: 700; font-size: 1.6rem;
        color: var(--accent-ink);
      }
      .headline-value.neg { color: var(--danger); }

      .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }
      .cc-card { cursor: pointer; border: 1px solid transparent; }
      .cc-card.selected { border-color: var(--mat-sys-primary); }
      .cc-top { display: flex; align-items: center; gap: 8px; }
      .cc-icon {
        display: grid; place-items: center; width: 32px; height: 32px;
        border-radius: 9px;
        background: color-mix(in srgb, var(--mat-sys-primary) 16%, transparent);
        color: var(--mat-sys-primary);
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
      .cc-name { font-weight: 600; }
      .cc-outstanding {
        font-family: 'Inter', sans-serif; font-size: 1.5rem; font-weight: 700;
        margin-top: 12px;
      }
      .cc-caption { font-size: 0.75rem; color: var(--mat-sys-on-surface-variant); }

      .meter {
        height: 6px; border-radius: 999px; margin: 10px 0 5px;
        background: color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent);
        overflow: hidden;
      }
      .meter span { display: block; height: 100%; background: var(--accent-grad); }
      .meter.hot span { background: var(--danger); }

      .cc-foot {
        display: flex; align-items: center; gap: 6px; margin-top: 12px;
        padding-top: 10px; border-top: 1px solid var(--hairline);
        font-size: 0.8rem; color: var(--mat-sys-on-surface-variant);
      }
      .foot-icon { font-size: 16px; width: 16px; height: 16px; }

      .panel { margin-bottom: 20px; }
      .card-title { font-weight: 700; font-size: 1.05rem; }
      .hint {
        margin: 8px 0 14px; font-size: 0.85rem; line-height: 1.5;
        color: var(--mat-sys-on-surface-variant);
      }

      .detail-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
      .tabs { display: flex; gap: 4px; padding: 3px; border-radius: 12px; background: var(--field-bg); }
      .tabs button {
        border: none; background: transparent; color: var(--mat-sys-on-surface-variant);
        font-family: inherit; font-size: 0.85rem; font-weight: 600;
        padding: 7px 16px; border-radius: 9px; cursor: pointer;
      }
      .tabs button.on { background: var(--accent-grad); color: var(--on-accent); }

      .form-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
      .form-row.tight { margin-bottom: 6px; }
      .field-wrap { display: flex; flex-direction: column; gap: 5px; }
      .field-label {
        font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em;
        text-transform: uppercase; color: var(--mat-sys-on-surface-variant);
      }
      .field {
        height: 44px; padding: 0 14px; border-radius: 10px;
        border: 1px solid var(--field-border);
        background: var(--field-bg); color: inherit;
        font-family: inherit; font-size: 0.92rem; box-sizing: border-box; outline: none;
      }
      .field:focus { border-color: var(--mat-sys-primary); }
      .field.num { width: 118px; }
      .field.num.wide { width: 150px; }
      .field.select { min-width: 180px; display: flex; align-items: center; }
      .field.select.grow { flex: 1 1 260px; }

      .action-btn {
        background: var(--accent-grad);
        color: #fff; border: none; border-radius: 10px; padding: 0 20px; height: 44px;
        font-weight: 600; font-size: 0.92rem; display: inline-flex; align-items: center;
        justify-content: center; gap: 6px; cursor: pointer; white-space: nowrap;
      }
      .action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .ghost-btn {
        height: 44px; padding: 0 16px; border-radius: 10px;
        border: 1px solid var(--field-border); background: var(--field-bg);
        color: inherit; font-family: inherit; font-size: 0.88rem; font-weight: 600;
        cursor: pointer; white-space: nowrap;
      }
      .ghost-btn.danger { color: var(--danger); border-color: var(--danger); }

      .stmt { border-top: 1px solid var(--hairline); }
      .stmt-row {
        display: flex; align-items: center; gap: 14px;
        padding: 12px 0; cursor: pointer;
      }
      .stmt-main { flex: 1 1 auto; min-width: 0; }
      .stmt-date { font-weight: 600; font-size: 0.92rem; }
      .stmt-sub { font-size: 0.78rem; color: var(--mat-sys-on-surface-variant); }
      .stmt-amounts { text-align: right; }
      .stmt-total { font-family: 'Inter', sans-serif; font-weight: 700; }
      .chev { color: var(--mat-sys-on-surface-variant); }

      .pill {
        font-size: 0.7rem; font-weight: 700; letter-spacing: 0.03em;
        padding: 4px 10px; border-radius: 999px; white-space: nowrap;
        background: color-mix(in srgb, var(--mat-sys-on-surface) 10%, transparent);
        color: var(--mat-sys-on-surface-variant);
      }
      .pill.due, .pill.is-unpaid {
        background: color-mix(in srgb, var(--danger) 16%, transparent); color: var(--danger);
      }
      .pill.is-partial {
        background: color-mix(in srgb, var(--mat-sys-primary) 16%, transparent);
        color: var(--mat-sys-primary);
      }
      .pill.is-paid {
        background: color-mix(in srgb, var(--accent-ink) 16%, transparent); color: var(--accent-ink);
      }

      .stmt-body { padding: 4px 0 18px; }
      .mini-row {
        display: flex; justify-content: space-between; font-size: 0.85rem;
        padding: 4px 0; color: var(--mat-sys-on-surface-variant);
      }
      .mini-row strong { color: var(--mat-sys-on-surface); }
      .sub-title {
        font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em;
        text-transform: uppercase; color: var(--mat-sys-on-surface-variant);
        margin: 16px 0 8px;
      }
      .lines { display: flex; flex-direction: column; }
      .line {
        display: flex; gap: 12px; align-items: baseline;
        padding: 6px 0; font-size: 0.85rem;
        border-bottom: 1px solid var(--hairline);
      }
      .line-date { width: 62px; flex-shrink: 0; color: var(--mat-sys-on-surface-variant); font-size: 0.78rem; }
      .line-desc { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .line-amt { font-variant-numeric: tabular-nums; font-weight: 600; }
      .line.credit .line-amt { color: var(--accent-ink); }

      .plan { border-top: 1px solid var(--hairline); padding: 12px 0; }
      .plan-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .plan-name { font-weight: 600; font-size: 0.92rem; }

      .spacer { flex: 1; }

      @media (max-width: 700px) {
        .card-grid { grid-template-columns: 1fr; gap: 12px; }
        .headline-value { font-size: 1.35rem; }
        .cc-outstanding { font-size: 1.25rem; }

        .form-row > *, .field-wrap { flex: 1 1 100% !important; width: 100%; }
        .field, .field.num, .field.num.wide, .field.select { width: 100%; min-width: 0; height: 48px; font-size: 16px; }
        .action-btn, .ghost-btn { height: 48px; width: 100%; }
        .tabs { width: 100%; }
        .tabs button { flex: 1; }

        .stmt-row { flex-wrap: wrap; gap: 8px; }
        .stmt-main { flex: 1 1 60%; }
        .line-desc { white-space: normal; }
      }
    `,
  ],
})
export class CreditCardsComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);
  private readonly notices = inject(NotificationService);

  readonly cards = signal<CreditCard[]>([]);
  readonly accounts = signal<AccountBalance[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly statements = signal<CardStatement[]>([]);
  readonly detail = signal<CardStatementDetail | null>(null);
  readonly emiPlans = signal<CardEmiPlan[]>([]);
  readonly unbilled = signal<Transaction[]>([]);
  readonly tab = signal<'bills' | 'emi' | 'settings'>('bills');

  readonly selected = computed(
    () => this.cards().find((c) => c.account_id === this.selectedId()) ?? null,
  );
  /** Credit card accounts that don't have a billing cycle set up yet. */
  readonly setupCandidates = computed(() =>
    this.accounts().filter(
      (a) =>
        a.type === 'credit_card' &&
        !this.cards().some((c) => c.account_id === a.id),
    ),
  );
  readonly payAccounts = computed(() =>
    this.accounts().filter((a) => a.type !== 'credit_card'),
  );
  readonly totalDue = computed(() =>
    this.cards().reduce((sum, c) => sum + Number(c.due_total), 0),
  );

  // Set-up form
  newAccountId: string | null = null;
  newStatementDay = 1;
  newDueDays = 20;
  newLimit: number | null = null;
  newPayFrom: string | null = null;

  // Payment form
  payAmount: number | null = null;
  payFrom: string | null = null;

  // Statement correction
  editTotal: number | null = null;

  // EMI form
  emiTxnId: string | null = null;
  emiTenure = 6;
  emiRate = 0;
  emiFee = 0;

  // Settings form
  editStatementDay = 1;
  editDueDays = 20;
  editLimit = 0;
  editMinPct = 5;
  editPayFrom: string | null = null;
  editAlertPct = 80;
  editRemindDays = 3;

  constructor() {
    this.load();
  }

  private load() {
    this.api.accountBalances().subscribe((r) => this.accounts.set(r.accounts));
    this.api.listCreditCards().subscribe({
      next: (cards) => {
        this.cards.set(cards);
        if (!this.selectedId() && cards.length) this.select(cards[0].account_id);
        else if (this.selectedId()) this.loadCardData();
      },
      error: () =>
        this.snack.open(
          'Could not load credit cards — has the migration been run?',
          'OK',
          { duration: 5000 },
        ),
    });
  }

  select(accountId: string) {
    if (this.selectedId() === accountId) return;
    this.selectedId.set(accountId);
    this.detail.set(null);
    this.loadCardData();
  }

  private loadCardData() {
    const id = this.selectedId();
    if (!id) return;
    this.api.listStatements(id).subscribe((s) => this.statements.set(s));
    this.api.listEmiPlans(id).subscribe((p) => this.emiPlans.set(p));
    this.api
      .unbilledCardTransactions(id)
      .subscribe((t) => this.unbilled.set(t));

    const card = this.cards().find((c) => c.account_id === id);
    if (card) this.fillSettings(card);
  }

  private fillSettings(card: CreditCard) {
    this.editStatementDay = card.statement_day;
    this.editDueDays = card.due_days_after;
    this.editLimit = Number(card.credit_limit);
    this.editMinPct = Number(card.min_due_pct);
    this.editPayFrom = card.default_payment_account_id;
    this.editAlertPct = card.utilisation_alert_pct;
    this.editRemindDays = card.reminder_days_before;
  }

  barWidth(c: CreditCard): number {
    return Math.min(100, c.utilisation_pct ?? 0);
  }
  statusLabel(s: CardStatement): string {
    return STATUS_META[s.status].label;
  }
  statusClass(s: CardStatement): string {
    return STATUS_META[s.status].cls;
  }
  remaining(s: CardStatement): number {
    return Math.max(0, Number(s.total_amount) - Number(s.paid_amount));
  }
  billedCount(p: CardEmiPlan): number {
    return (p.installments ?? []).filter((i) => i.billed).length;
  }

  toggle(s: CardStatement) {
    if (this.detail()?.id === s.id) {
      this.detail.set(null);
      return;
    }
    this.api.getStatement(s.id).subscribe((d) => {
      this.detail.set(d);
      this.editTotal = Number(d.total_amount);
      this.payAmount = this.remaining(d);
      this.payFrom =
        this.selected()?.default_payment_account_id ??
        this.payAccounts()[0]?.id ??
        null;
    });
  }

  setUpCard() {
    if (!this.newAccountId) return;
    this.api
      .createCreditCard({
        account_id: this.newAccountId,
        statement_day: this.newStatementDay,
        due_days_after: this.newDueDays,
        credit_limit: Number(this.newLimit ?? 0),
        ...(this.newPayFrom
          ? { default_payment_account_id: this.newPayFrom }
          : {}),
      })
      .subscribe({
        next: () => {
          this.snack.open('Card billing set up', 'OK', { duration: 2500 });
          this.newAccountId = null;
          this.newLimit = null;
          this.newPayFrom = null;
          // Generate any bill whose statement day has already gone by.
          this.api.runCreditCards().subscribe({
            next: () => {
              this.notices.refresh();
              this.load();
            },
            error: () => this.load(),
          });
        },
        error: (e) => this.fail(e, 'Could not set up the card'),
      });
  }

  saveTotal(s: CardStatement) {
    if (this.editTotal == null) return;
    this.api
      .updateStatement(s.id, { total_amount: Number(this.editTotal) })
      .subscribe({
        next: () => {
          this.snack.open('Bill updated', 'OK', { duration: 2000 });
          this.refreshStatement(s.id);
        },
        error: (e) => this.fail(e, 'Could not update the bill'),
      });
  }

  pay(s: CardStatement) {
    if (!this.payAmount || this.payAmount <= 0) return;
    this.api
      .payStatement(s.id, {
        amount: Number(this.payAmount),
        ...(this.payFrom ? { from_account_id: this.payFrom } : {}),
      })
      .subscribe({
        next: (r) => {
          this.snack.open(
            r.statement.status === 'paid'
              ? 'Bill paid — deducted from your bank account'
              : 'Part payment recorded',
            'OK',
            { duration: 3000 },
          );
          this.refreshStatement(s.id);
          this.notices.refresh();
        },
        error: (e) => this.fail(e, 'Payment failed'),
      });
  }

  convertToEmi() {
    if (!this.emiTxnId) return;
    this.api
      .createEmiPlan({
        transaction_id: this.emiTxnId,
        tenure_months: this.emiTenure,
        annual_rate: Number(this.emiRate) || 0,
        processing_fee: Number(this.emiFee) || 0,
      })
      .subscribe({
        next: () => {
          this.snack.open('Converted to EMI', 'OK', { duration: 2500 });
          this.emiTxnId = null;
          this.loadCardData();
        },
        error: (e) => this.fail(e, 'Could not convert to EMI'),
      });
  }

  cancelEmi(p: CardEmiPlan) {
    if (!confirm(`Cancel the EMI plan for "${p.description}"?`)) return;
    this.api.deleteEmiPlan(p.id).subscribe({
      next: () => {
        this.snack.open('EMI plan cancelled', 'OK', { duration: 2000 });
        this.loadCardData();
      },
      error: (e) => this.fail(e, 'Could not cancel the plan'),
    });
  }

  saveSettings(card: CreditCard) {
    this.api
      .updateCreditCard(card.account_id, {
        statement_day: this.editStatementDay,
        due_days_after: this.editDueDays,
        credit_limit: Number(this.editLimit),
        min_due_pct: Number(this.editMinPct),
        default_payment_account_id: this.editPayFrom,
        utilisation_alert_pct: this.editAlertPct,
        reminder_days_before: this.editRemindDays,
      })
      .subscribe({
        next: () => {
          this.snack.open('Settings saved', 'OK', { duration: 2000 });
          this.load();
        },
        error: (e) => this.fail(e, 'Could not save settings'),
      });
  }

  disable(card: CreditCard) {
    if (
      !confirm(
        `Stop generating bills for "${card.account?.name}"? Existing bills are kept.`,
      )
    ) {
      return;
    }
    this.api.deleteCreditCard(card.account_id).subscribe({
      next: () => {
        this.snack.open('Billing stopped', 'OK', { duration: 2000 });
        this.selectedId.set(null);
        this.statements.set([]);
        this.load();
      },
      error: (e) => this.fail(e, 'Could not stop billing'),
    });
  }

  private refreshStatement(id: string) {
    this.api.getStatement(id).subscribe((d) => {
      this.detail.set(d);
      this.editTotal = Number(d.total_amount);
      this.payAmount = this.remaining(d);
    });
    this.loadStatements();
    this.api.listCreditCards().subscribe((c) => this.cards.set(c));
  }

  private loadStatements() {
    const id = this.selectedId();
    if (id) this.api.listStatements(id).subscribe((s) => this.statements.set(s));
  }

  private fail(e: unknown, fallback: string) {
    const message =
      (e as { error?: { message?: string } })?.error?.message ?? fallback;
    this.snack.open(message, 'OK', { duration: 5000 });
  }
}
