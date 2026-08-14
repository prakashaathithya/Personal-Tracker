export type StatementStatus = 'unpaid' | 'partially_paid' | 'paid' | 'carried';

export type NotificationType =
  | 'card_bill_generated'
  | 'card_bill_due_soon'
  | 'card_bill_overdue'
  | 'card_limit_warning';

export interface CreditCardRow {
  account_id: string;
  user_id: string;
  statement_day: number;
  due_days_after: number;
  credit_limit: number;
  default_payment_account_id: string | null;
  min_due_pct: number;
  utilisation_alert_pct: number;
  reminder_days_before: number;
  created_at: string;
  account?: { id: string; name: string; type: string } | null;
}

export interface StatementRow {
  id: string;
  user_id: string;
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
  created_at: string;
}

export interface EmiPlanRow {
  id: string;
  user_id: string;
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
}

export interface EmiInstallmentRow {
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

/** Embed hint: `credit_cards` has two FKs into `accounts`, so PostgREST
 *  needs the constraint name to know which one to follow. */
export const CARD_EMBED =
  '*, account:accounts!credit_cards_account_id_fkey(id,name,type), payment_account:accounts!credit_cards_default_payment_account_id_fkey(id,name,type)';
