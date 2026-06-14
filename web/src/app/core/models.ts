export type NeedClass = 'Needs' | 'Wants' | 'Saving' | 'Others';

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

export interface Transaction {
  id: string;
  txn_date: string;
  description: string;
  amount: number;
  planned: boolean;
  category_id: string | null;
  payment_type_id: string | null;
  category?: { id: string; name: string; need_class: NeedClass } | null;
  payment_type?: { id: string; name: string } | null;
}

export interface Paged<T> {
  data: T[];
  count: number;
  limit: number;
  offset: number;
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
