-- Introduce financial accounts and an income/expense/transfer dimension.
-- Amount stays a positive magnitude (the amount >= 0 check is preserved);
-- `direction` carries the sign, and transfers link a second account.

create type public.account_type as enum
  ('cash','bank','credit_card','wallet','investment');
create type public.txn_direction as enum
  ('income','expense','transfer');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type public.account_type not null default 'bank',
  opening_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
create policy "own accounts" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index accounts_user_idx on public.accounts (user_id);

alter table public.transactions
  add column direction public.txn_direction not null default 'expense',
  add column account_id uuid references public.accounts (id) on delete set null,
  add column transfer_account_id uuid references public.accounts (id) on delete set null;

create index transactions_account_idx on public.transactions (account_id);
create index transactions_direction_idx on public.transactions (user_id, direction);
