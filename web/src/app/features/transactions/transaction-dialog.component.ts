import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { Account, Category, Direction, PaymentType, Transaction } from '../../core/models';

export interface TxnDialogData {
  categories: Category[];
  paymentTypes: PaymentType[];
  accounts: Account[];
  transaction?: Transaction;
}

@Component({
  selector: 'app-transaction-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatSelectModule,
  ],
  template: `
    <div class="dialog">
      <header class="dialog-head">
        <div>
          <h2>{{ data.transaction ? 'Edit' : 'Add' }} transaction</h2>
          <p class="subtitle">Log an expense, income, or transfer</p>
        </div>
        <button type="button" class="close-btn" mat-dialog-close aria-label="Close">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <div class="dialog-body">
        <form [formGroup]="form" class="form">
          <div
            class="segmented"
            role="tablist"
            [class.is-income]="direction() === 'income'"
            [class.is-transfer]="direction() === 'transfer'"
          >
            <button
              type="button"
              class="seg"
              [class.active]="direction() === 'expense'"
              (click)="setDirection('expense')"
            >
              Expense
            </button>
            <button
              type="button"
              class="seg"
              [class.active]="direction() === 'income'"
              (click)="setDirection('income')"
            >
              Income
            </button>
            <button
              type="button"
              class="seg"
              [class.active]="direction() === 'transfer'"
              (click)="setDirection('transfer')"
            >
              Transfer
            </button>
          </div>

          <div class="field">
            <label for="txn-date">Date<span class="req">*</span></label>
            <input id="txn-date" type="date" class="control" formControlName="txn_date" />
          </div>

          <div class="field">
            <label for="txn-desc">Description<span class="req">*</span></label>
            <input
              id="txn-desc"
              type="text"
              class="control"
              formControlName="description"
              placeholder="e.g. Grocery shopping"
            />
          </div>

          <div class="field">
            <label for="txn-amount">Amount<span class="req">*</span></label>
            <div class="control amount-control">
              <span class="rupee">₹</span>
              <input
                id="txn-amount"
                type="number"
                formControlName="amount"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label>{{ isTransfer() ? 'From account' : 'Account' }}</label>
              <mat-select
                class="select-control"
                panelClass="txn-select-panel"
                formControlName="account_id"
                placeholder="— none —"
              >
                <mat-option [value]="null">— none —</mat-option>
                @for (a of data.accounts; track a.id) {
                  <mat-option [value]="a.id">{{ a.name }}</mat-option>
                }
              </mat-select>
            </div>

            @if (isTransfer()) {
              <div class="field">
                <label>To account</label>
                <mat-select
                  class="select-control"
                  panelClass="txn-select-panel"
                  formControlName="transfer_account_id"
                  placeholder="— none —"
                >
                  <mat-option [value]="null">— none —</mat-option>
                  @for (a of data.accounts; track a.id) {
                    <mat-option [value]="a.id">{{ a.name }}</mat-option>
                  }
                </mat-select>
              </div>
            } @else {
              <div class="field">
                <label>Category</label>
                <mat-select
                  class="select-control"
                  panelClass="txn-select-panel"
                  formControlName="category_id"
                  placeholder="— none —"
                >
                  <mat-option [value]="null">— none —</mat-option>
                  @for (c of data.categories; track c.id) {
                    <mat-option [value]="c.id">{{ c.name }}</mat-option>
                  }
                </mat-select>
              </div>
            }
          </div>

          @if (!isTransfer()) {
            <div class="field-row">
              <div class="field">
                <label>Payment type</label>
                <mat-select
                  class="select-control"
                  panelClass="txn-select-panel"
                  formControlName="payment_type_id"
                  placeholder="— none —"
                >
                  <mat-option [value]="null">— none —</mat-option>
                  @for (p of data.paymentTypes; track p.id) {
                    <mat-option [value]="p.id">{{ p.name }}</mat-option>
                  }
                </mat-select>
              </div>

              <div class="field">
                <label>Planned</label>
                <button
                  type="button"
                  class="plan-btn"
                  [class.on]="planned()"
                  (click)="togglePlanned()"
                >
                  <mat-icon>{{ planned() ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                  <span>{{ planned() ? 'Planned' : 'Not planned' }}</span>
                </button>
              </div>
            </div>
          }
        </form>
      </div>

      <footer class="dialog-foot">
        <button type="button" class="btn-text" mat-dialog-close>Cancel</button>
        <button type="button" class="btn-save" [disabled]="form.invalid" (click)="save()">
          Save
        </button>
      </footer>
    </div>
  `,
  styles: [
    `
      :host { display: block; }

      .dialog {
        display: flex;
        flex-direction: column;
        max-height: 90vh;
      }

      .dialog-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 24px 26px 18px;
      }
      .dialog-head h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--ink);
      }
      .subtitle {
        margin: 5px 0 0;
        color: var(--ink-faint);
        font-size: 0.92rem;
      }
      .close-btn {
        flex: none;
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border-radius: 11px;
        border: 1px solid var(--field-border);
        background: var(--field-bg);
        color: var(--ink-soft);
        cursor: pointer;
        transition: background 140ms ease, color 140ms ease;

        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
      .close-btn:hover { background: var(--hover-bg); color: var(--ink); }

      .dialog-body {
        flex: 1 1 auto;
        min-height: 0;
        padding: 4px 26px 10px;
        overflow-y: auto;
      }

      .form { display: flex; flex-direction: column; gap: 16px; }

      .field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
      .field label {
        font-size: 0.82rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        color: var(--ink-faint);
      }
      .req { color: var(--danger); margin-left: 2px; }

      .field-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      /* Frosted glass wells — translucent + backdrop blur so they pick up
         and reflect the aurora background through the dialog surface. */
      .control,
      .select-control.mat-mdc-select,
      .plan-btn {
        width: 100%;
        box-sizing: border-box;
        border-radius: 13px;
        background: var(--field-bg);
        border: 1px solid var(--field-border);
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
        box-shadow: inset 0 1px 0 var(--glass-highlight);
      }

      .control {
        padding: 13px 15px;
        color: var(--ink);
        font: inherit;
        font-size: 0.98rem;
        outline: none;
        transition: border-color 140ms ease, background 140ms ease;
      }
      .control::placeholder { color: var(--ink-faint); }
      .control:focus,
      .control:focus-within { border-color: var(--accent); }

      input[type='date'].control { color-scheme: light dark; }
      input[type='date']::-webkit-calendar-picker-indicator {
        cursor: pointer;
        opacity: 0.7;
      }

      /* Standalone mat-select styled as a glass well */
      .select-control.mat-mdc-select {
        display: flex;
        align-items: center;
        min-height: 48px;
        padding: 0 15px;
        color: var(--ink);
        font-size: 0.98rem;
        transition: border-color 140ms ease;
      }
      .select-control.mat-mdc-select[aria-expanded='true'] {
        border-color: var(--accent);
      }

      .amount-control {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 11px 15px;
      }
      .amount-control .rupee {
        color: var(--accent);
        font-weight: 700;
        font-size: 1.05rem;
      }
      .amount-control input {
        flex: 1;
        width: 100%;
        min-width: 0;
        border: none;
        background: transparent;
        outline: none;
        color: var(--ink);
        font: inherit;
        font-size: 1.05rem;
      }

      /* Planned — selectable pill that shows its state clearly */
      .plan-btn {
        display: flex;
        align-items: center;
        gap: 9px;
        min-height: 48px;
        padding: 0 15px;
        color: var(--ink-soft);
        font: inherit;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        transition: border-color 140ms ease, background 140ms ease, color 140ms ease;

        mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--ink-faint); }
      }
      .plan-btn:hover {
        border-color: color-mix(in srgb, var(--accent) 40%, transparent);
      }
      .plan-btn.on {
        border-color: color-mix(in srgb, var(--accent) 55%, transparent);
        background: color-mix(in srgb, var(--accent) 14%, var(--field-bg));
        color: var(--accent-ink);

        mat-icon { color: var(--accent-bright); }
      }

      /* Segmented tabs — coral active pill (expense), color-coded per direction */
      .segmented {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        padding: 5px;
        border-radius: 14px;
        background: var(--field-bg);
        border: 1px solid var(--field-border);
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
        box-shadow: inset 0 1px 0 var(--glass-highlight);
      }
      .seg {
        border: none;
        background: transparent;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        font-size: 0.95rem;
        color: var(--ink-soft);
        padding: 11px 8px;
        border-radius: 10px;
        transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
      }
      .seg:hover:not(.active) { color: var(--ink); }
      .seg.active {
        color: #fff;
        background: linear-gradient(135deg, #f7727c, #ef5561);
        box-shadow: 0 4px 14px rgba(239, 85, 97, 0.4);
      }
      .segmented.is-income .seg.active {
        background: var(--accent-grad);
        color: var(--on-accent);
        box-shadow: 0 4px 14px oklch(0.6 0.15 168 / 0.4);
      }
      .segmented.is-transfer .seg.active {
        background: linear-gradient(135deg, #56b2e8, #3f83d8);
        color: #fff;
        box-shadow: 0 4px 14px rgba(63, 131, 216, 0.4);
      }

      .dialog-foot {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        padding: 16px 26px 20px;
        margin-top: 6px;
        border-top: 1px solid var(--hairline);
      }
      .btn-text {
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--accent-bright);
        font: inherit;
        font-weight: 700;
        font-size: 0.95rem;
        padding: 11px 18px;
        border-radius: 11px;
        transition: background 140ms ease;
      }
      .btn-text:hover { background: var(--hover-bg); }
      .btn-save {
        border: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        font-size: 0.95rem;
        padding: 11px 26px;
        border-radius: 11px;
        background: var(--accent-grad);
        color: var(--on-accent);
        box-shadow: 0 4px 14px oklch(0.6 0.15 168 / 0.4);
        transition: transform 120ms ease, box-shadow 120ms ease;
      }
      .btn-save:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px oklch(0.6 0.15 168 / 0.5);
      }
      .btn-save:disabled {
        background: var(--field-bg);
        color: var(--ink-faint);
        box-shadow: none;
        cursor: not-allowed;
      }
    `,
  ],
})
export class TransactionDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject(MatDialogRef<TransactionDialogComponent>);
  readonly data = inject<TxnDialogData>(MAT_DIALOG_DATA);

  readonly direction = signal<Direction>(
    this.data.transaction?.direction ?? 'expense',
  );
  readonly isTransfer = computed(() => this.direction() === 'transfer');
  readonly planned = signal(this.data.transaction?.planned ?? false);

  readonly form = this.fb.nonNullable.group({
    direction: [this.data.transaction?.direction ?? ('expense' as Direction)],
    txn_date: [
      this.data.transaction?.txn_date?.slice(0, 10) ?? todayStr(),
      Validators.required,
    ],
    description: [this.data.transaction?.description ?? '', Validators.required],
    amount: [this.data.transaction?.amount ?? 0, [Validators.required, Validators.min(0)]],
    category_id: [this.data.transaction?.category_id ?? (null as string | null)],
    payment_type_id: [this.data.transaction?.payment_type_id ?? (null as string | null)],
    account_id: [
      this.data.transaction?.account_id ??
        (this.data.accounts[0]?.id ?? null as string | null),
    ],
    transfer_account_id: [
      this.data.transaction?.transfer_account_id ?? (null as string | null),
    ],
    planned: [this.data.transaction?.planned ?? false],
  });

  constructor() {
    this.form.controls.direction.valueChanges.subscribe((d) =>
      this.direction.set(d),
    );
  }

  setDirection(d: Direction) {
    this.form.controls.direction.setValue(d);
  }

  togglePlanned() {
    const next = !this.planned();
    this.planned.set(next);
    this.form.controls.planned.setValue(next);
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const transfer = v.direction === 'transfer';
    this.ref.close({
      direction: v.direction,
      txn_date: v.txn_date,
      description: v.description,
      amount: Number(v.amount),
      category_id: transfer ? undefined : v.category_id || undefined,
      payment_type_id: transfer ? undefined : v.payment_type_id || undefined,
      account_id: v.account_id || undefined,
      transfer_account_id: transfer ? v.transfer_account_id || undefined : undefined,
      planned: transfer ? false : v.planned,
    });
  }
}

function todayStr(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
