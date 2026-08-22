-- Need-classification for categories (from the Excel "Category" column)
create type need_class as enum ('Needs', 'Wants', 'Saving', 'Others');

-- User profile, 1:1 with auth.users
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- Per-user expense categories (Excel "Type" + "Category")
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  need_class  need_class not null default 'Others',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- Per-user payment methods (Excel "Payment Type")
create table public.payment_types (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- The main ledger (Excel "Expenses" sheet)
create table public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  txn_date        date not null,
  description     text not null,
  amount          numeric(14, 2) not null check (amount >= 0),
  category_id     uuid references public.categories (id) on delete set null,
  payment_type_id uuid references public.payment_types (id) on delete set null,
  planned         boolean not null default false,  -- Excel "PUP": Planned / Un-Planned
  created_at      timestamptz not null default now()
);
create index idx_transactions_user_date on public.transactions (user_id, txn_date desc);
create index idx_transactions_category on public.transactions (category_id);

-- Recurring monthly plan items (Excel "Regular" sheet, lower block)
create table public.budget_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  amount      numeric(14, 2) not null default 0,
  note        text,
  created_at  timestamptz not null default now()
);

-- Per-month salary tracking (Excel "Regular" sheet, Month/Salary/Usage/Balance)
create table public.monthly_budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  month       date not null,  -- first day of the month
  salary      numeric(14, 2) not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, month)
);

-- Loans (Excel "EMI" sheet header info)
create table public.loans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  principal    numeric(14, 2) not null,
  annual_rate  numeric(6, 3),         -- annual interest rate %
  emi_amount   numeric(14, 2),
  start_date   date,
  created_at   timestamptz not null default now()
);

-- Amortization schedule rows (Excel "EMI" sheet body)
create table public.loan_schedule (
  id              uuid primary key default gen_random_uuid(),
  loan_id         uuid not null references public.loans (id) on delete cascade,
  period          integer not null,   -- EMI number (1..N)
  due_date        date,
  emi             numeric(14, 2) not null,
  interest        numeric(14, 2) not null,
  principal_paid  numeric(14, 2) not null,
  balance         numeric(14, 2) not null,
  paid            boolean not null default false,
  unique (loan_id, period)
);
create index idx_loan_schedule_loan on public.loan_schedule (loan_id, period);
