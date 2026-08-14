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
  need_class: NeedClass;
  total: number;
  count: number;
  planned: number;
  unplanned: number;
}

export interface PaymentTypeTotal {
  payment_type: string;
  total: number;
  count: number;
}

export interface MatrixRow {
  /** 1-12 */
  month: number;
  /** Aligned to `ReportMatrix.columns`. */
  values: number[];
  total: number;
}

export interface ReportMatrix {
  year: number;
  dim: 'category' | 'payment_type' | 'need_class';
  columns: string[];
  rows: MatrixRow[];
  columnTotals: number[];
  grandTotal: number;
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

/** 'carried' = rolled into the next bill because it wasn't cleared in time. */
export type StatementStatus = 'unpaid' | 'partially_paid' | 'paid' | 'carried';

export interface CardStatement {
  id: string;
  card_account_id: string;
  period_start: string;
  period_end: string;
  statement_date: string;
  due_date: string;
  computed_amount: number;
  total_amount: number;
  minimum_due: number;
  paid_amount: number;
  carried_over: number;
  status: StatementStatus;
}

export interface CardStatementDetail extends CardStatement {
  transactions: Transaction[];
  installments: (CardEmiInstallment & {
    plan?: { id: string; description: string; tenure_months: number } | null;
  })[];
}

export interface CreditCard {
  account_id: string;
  statement_day: number;
  due_days_after: number;
  credit_limit: number;
  default_payment_account_id: string | null;
  min_due_pct: number;
  utilisation_alert_pct: number;
  reminder_days_before: number;
  account?: { id: string; name: string; type: AccountType } | null;
  payment_account?: { id: string; name: string; type: AccountType } | null;
  /** How much is owed on the card right now, bills or not. */
  outstanding: number;
  available: number | null;
  utilisation_pct: number | null;
  open_statements: CardStatement[];
  due_total: number;
  next_due_date: string | null;
}

export interface CardEmiInstallment {
  id: string;
  plan_id: string;
  period: number;
  due_date: string;
  emi: number;
  interest: number;
  principal_paid: number;
  balance: number;
  billed: boolean;
  statement_id: string | null;
}

export interface CardEmiPlan {
  id: string;
  card_account_id: string;
  transaction_id: string | null;
  category_id: string | null;
  description: string;
  principal: number;
  annual_rate: number;
  tenure_months: number;
  emi_amount: number;
  processing_fee: number;
  start_date: string;
  is_active: boolean;
  installments?: CardEmiInstallment[];
}

export type NotificationType =
  | 'card_bill_generated'
  | 'card_bill_due_soon'
  | 'card_bill_overdue'
  | 'card_limit_warning';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_id: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
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
