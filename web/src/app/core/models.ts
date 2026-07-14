export type NeedClass = 'Needs' | 'Wants' | 'Saving' | 'Others';

export type Direction = 'income' | 'expense' | 'transfer';

export type AccountType =
  | 'cash'
  | 'bank'
  | 'credit_card'
  | 'wallet'
  | 'investment';

export interface Category {
  id: string;
  name: string;
  need_class: NeedClass;
  is_active: boolean;
}

export interface PaymentType {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  opening_balance: number;
  is_active: boolean;
}

export interface AccountBalance extends Account {
  balance: number;
}

export interface NetWorth {
  accounts: AccountBalance[];
  net_worth: number;
}

export interface Transaction {
  id: string;
  txn_date: string;
  description: string;
  amount: number;
  direction: Direction;
  planned: boolean;
  category_id: string | null;
  payment_type_id: string | null;
  account_id: string | null;
  transfer_account_id: string | null;
  category?: { id: string; name: string; need_class: NeedClass } | null;
  payment_type?: { id: string; name: string } | null;
  account?: { id: string; name: string; type: AccountType } | null;
  transfer_account?: { id: string; name: string; type: AccountType } | null;
  receipt_path?: string | null;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  account_id: string | null;
  target_date: string | null;
  account?: { id: string; name: string; type: AccountType } | null;
}

export interface NetWorthPoint {
  month: string;
  net_worth: number;
}

export interface Paged<T> {
  data: T[];
  count: number;
  limit: number;
  offset: number;
}

export type MatchType = 'contains' | 'equals' | 'regex';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CategorizationRule {
  id: string;
  match: MatchType;
  pattern: string;
  category_id: string;
  priority: number;
  is_active: boolean;
  category?: { id: string; name: string; need_class: NeedClass } | null;
}

export interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  direction: Direction;
  frequency: Frequency;
  interval_count: number;
  next_run: string;
  end_date: string | null;
  is_active: boolean;
  last_generated: string | null;
  category_id: string | null;
  payment_type_id: string | null;
  account_id: string | null;
  transfer_account_id: string | null;
  category?: { id: string; name: string } | null;
  account?: { id: string; name: string } | null;
}

export interface BudgetItem {
  id: string;
  name: string;
  amount: number;
  note: string | null;
}

export interface MonthlyBudget {
  id: string;
  month: string;
  salary: number;
}

export interface LoanScheduleRow {
  id: string;
  period: number;
  due_date: string;
  emi: number;
  interest: number;
  principal_paid: number;
  balance: number;
  paid: boolean;
}

export interface Loan {
  id: string;
  name: string;
  principal: number;
  annual_rate: number | null;
  emi_amount: number | null;
  start_date: string | null;
  schedule?: LoanScheduleRow[];
}

export interface Summary {
  income: number;
  expense: number;
  net: number;
  total: number;
  planned: number;
  unplanned: number;
  count: number;
}

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

export interface NeedClassTotal {
  need_class: NeedClass;
  total: number;
}

export interface MonthlyReportRow {
  year: number;
  month: number;
  salary: number;
  usage: number;
  balance: number;
}

export interface ImportRow {
  txn_date: string;
  description: string;
  amount: number;
  category?: string;
  payment_type?: string;
  planned?: boolean;
}

export interface ImportPreview {
  total: number;
  duplicates: number;
  newRows: number;
  newCategories: string[];
  newPaymentTypes: string[];
  /** Duplicate flag per input row, aligned to the order sent. */
  flags: boolean[];
}
