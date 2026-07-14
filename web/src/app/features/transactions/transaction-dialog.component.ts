import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
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
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatButtonToggleModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.transaction ? 'Edit' : 'Add' }} transaction</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-button-toggle-group
          class="direction-toggle"
          formControlName="direction"
          hideSingleSelectionIndicator
        >
          <mat-button-toggle value="expense">Expense</mat-button-toggle>
          <mat-button-toggle value="income">Income</mat-button-toggle>
          <mat-button-toggle value="transfer">Transfer</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field class="full-width">
          <mat-label>Date</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="txn_date" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Description</mat-label>
          <input matInput formControlName="description" />
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Amount</mat-label>
          <input matInput type="number" formControlName="amount" />
          <span matTextPrefix>₹&nbsp;</span>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>{{ isTransfer() ? 'From account' : 'Account' }}</mat-label>
          <mat-select formControlName="account_id">
            <mat-option [value]="null">— none —</mat-option>
            @for (a of data.accounts; track a.id) {
              <mat-option [value]="a.id">{{ a.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (isTransfer()) {
          <mat-form-field class="full-width">
            <mat-label>To account</mat-label>
            <mat-select formControlName="transfer_account_id">
              <mat-option [value]="null">— none —</mat-option>
              @for (a of data.accounts; track a.id) {
                <mat-option [value]="a.id">{{ a.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        } @else {
          <mat-form-field class="full-width">
            <mat-label>Category</mat-label>
            <mat-select formControlName="category_id">
              <mat-option [value]="null">— none —</mat-option>
              @for (c of data.categories; track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Payment type</mat-label>
            <mat-select formControlName="payment_type_id">
              <mat-option [value]="null">— none —</mat-option>
              @for (p of data.paymentTypes; track p.id) {
                <mat-option [value]="p.id">{{ p.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-slide-toggle formControlName="planned">Planned</mat-slide-toggle>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Cancel</button>
      <button matButton="filled" [disabled]="form.invalid" (click)="save()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .form { display: flex; flex-direction: column; gap: 8px; min-width: 320px; padding-top: 8px; }
      .direction-toggle { width: 100%; margin-bottom: 4px; }
      .direction-toggle ::ng-deep .mat-button-toggle { flex: 1; }
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

  readonly form = this.fb.nonNullable.group({
    direction: [this.data.transaction?.direction ?? ('expense' as Direction)],
    txn_date: [
      this.data.transaction ? new Date(this.data.transaction.txn_date) : new Date(),
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

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const transfer = v.direction === 'transfer';
    this.ref.close({
      direction: v.direction,
      txn_date: toIso(v.txn_date),
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

function toIso(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
