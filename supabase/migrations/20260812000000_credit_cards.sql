-- =====================================================================
-- Credit card bills, EMI plans and in-app notifications.
--
-- A credit card is already an `accounts` row with type='credit_card', so
-- balances and net worth keep working untouched. This migration only adds
-- the billing cycle metadata, the statements themselves, EMI conversion
-- and the notification feed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Per-card billing configuration (1:1 with a credit_card account)
-- ---------------------------------------------------------------------
create table if not exists public.credit_cards (
  account_id                 uuid primary key
                               references public.accounts (id) on delete cascade,
  user_id                    uuid not null
                               references auth.users (id) on delete cascade,
  -- Day of month the bill generates. Clamped to the last day in short
  -- months, so 31 means "month end" for February.
  statement_day              smallint not null
                               check (statement_day between 1 and 31),
  -- Grace period: due_date = statement_date + due_days_after.
  due_days_after             smallint not null default 20
                               check (due_days_after between 1 and 60),
  credit_limit               numeric(14, 2) not null default 0
                               check (credit_limit >= 0),
  -- Bank account a bill payment defaults to (overridable when paying).
  default_payment_account_id uuid
                               references public.accounts (id) on delete set null,
  -- Minimum due as a share of the bill, the way card issuers state it.
  min_due_pct                numeric(5, 2) not null default 5
                               check (min_due_pct between 0 and 100),
  utilisation_alert_pct      smallint not null default 80
                               check (utilisation_alert_pct between 1 and 100),
  reminder_days_before       smallint not null default 3
                               check (reminder_days_before between 0 and 30),
  created_at                 timestamptz not null default now()
);

create index if not exists credit_cards_user_idx
  on public.credit_cards (user_id);

-- ---------------------------------------------------------------------
-- 2. Generated statements
-- ---------------------------------------------------------------------
-- 'carried' = still owed at the next cutoff, so the remainder was rolled
-- into the following statement. Excluding it from the open-bill total is
-- what stops the same rupees being counted on two statements at once.
do $$ begin
  create type public.statement_status as enum (
    'unpaid', 'partially_paid', 'paid', 'carried'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.card_statements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  card_account_id uuid not null references public.accounts (id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  statement_date  date not null,
  due_date        date not null,
  -- What the app derived from the card's transactions...
  computed_amount numeric(14, 2) not null default 0,
  -- ...and what's actually owed, editable to match the bank's SMS.
  total_amount    numeric(14, 2) not null default 0,
  minimum_due     numeric(14, 2) not null default 0,
  paid_amount     numeric(14, 2) not null default 0,
  -- Unpaid remainder rolled in from the previous statement.
  carried_over    numeric(14, 2) not null default 0,
  status          public.statement_status not null default 'unpaid',
  created_at      timestamptz not null default now(),
  unique (card_account_id, statement_date)
);

create index if not exists card_statements_user_idx
  on public.card_statements (user_id, statement_date desc);
create index if not exists card_statements_card_idx
  on public.card_statements (card_account_id, statement_date desc);

-- Links a payment transfer (and every billed spend) to the statement it
-- settled, so a bill can show exactly which transactions made it up.
alter table public.transactions
  add column if not exists statement_id uuid
    references public.card_statements (id) on delete set null;

create index if not exists transactions_statement_idx
  on public.transactions (statement_id);

-- ---------------------------------------------------------------------
-- 3. Card EMI: converting one card purchase into N installments
-- ---------------------------------------------------------------------
create table if not exists public.card_emi_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  card_account_id uuid not null references public.accounts (id) on delete cascade,
  -- The original purchase. It stays on the card (you do owe all of it, so
  -- the account balance stays right) but is excluded from the statement;
  -- the installments below get billed instead.
  transaction_id  uuid references public.transactions (id) on delete set null,
  -- Copied off the source purchase so each month's interest charge lands in
  -- the same category, even if the original transaction is later deleted.
  category_id     uuid references public.categories (id) on delete set null,
  description     text not null,
  principal       numeric(14, 2) not null check (principal >= 0),
  annual_rate     numeric(6, 3) not null default 0 check (annual_rate >= 0),
  tenure_months   int not null check (tenure_months >= 1),
  emi_amount      numeric(14, 2) not null check (emi_amount >= 0),
  processing_fee  numeric(14, 2) not null default 0 check (processing_fee >= 0),
  start_date      date not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists card_emi_plans_card_idx
  on public.card_emi_plans (card_account_id) where is_active;
create index if not exists card_emi_plans_txn_idx
  on public.card_emi_plans (transaction_id);

create table if not exists public.card_emi_installments (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null
                   references public.card_emi_plans (id) on delete cascade,
  period         int not null,
  -- The statement this installment should land on.
  due_date       date not null,
  emi            numeric(14, 2) not null,
  interest       numeric(14, 2) not null,
  principal_paid numeric(14, 2) not null,
  balance        numeric(14, 2) not null,
  billed         boolean not null default false,
  statement_id   uuid references public.card_statements (id) on delete set null,
  unique (plan_id, period)
);

create index if not exists card_emi_installments_due_idx
  on public.card_emi_installments (due_date) where not billed;

-- ---------------------------------------------------------------------
-- 4. In-app notification feed (bell + toast)
-- ---------------------------------------------------------------------
do $$ begin
  create type public.notification_type as enum (
    'card_bill_generated',
    'card_bill_due_soon',
    'card_bill_overdue',
    'card_limit_warning'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       public.notification_type not null,
  title      text not null,
  body       text,
  -- What it points at (a statement or a card account) plus a route.
  entity_id  uuid,
  link       text,
  -- Stops the same alert being raised twice on repeated catch-up runs.
  dedupe_key text,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists notifications_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

-- ---------------------------------------------------------------------
-- 5. RLS — every table scoped to the owning user, as elsewhere
-- ---------------------------------------------------------------------
alter table public.credit_cards           enable row level security;
alter table public.card_statements        enable row level security;
alter table public.card_emi_plans         enable row level security;
alter table public.card_emi_installments  enable row level security;
alter table public.notifications          enable row level security;

drop policy if exists "credit_cards owner" on public.credit_cards;
create policy "credit_cards owner" on public.credit_cards
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "card_statements owner" on public.card_statements;
create policy "card_statements owner" on public.card_statements
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "card_emi_plans owner" on public.card_emi_plans;
create policy "card_emi_plans owner" on public.card_emi_plans
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Installments have no user_id of their own; they inherit their plan's.
drop policy if exists "card_emi_installments owner" on public.card_emi_installments;
create policy "card_emi_installments owner" on public.card_emi_installments
  for all to authenticated
  using (
    exists (
      select 1 from public.card_emi_plans p
      where p.id = card_emi_installments.plan_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.card_emi_plans p
      where p.id = card_emi_installments.plan_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "notifications owner" on public.notifications;
create policy "notifications owner" on public.notifications
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on
  public.credit_cards,
  public.card_statements,
  public.card_emi_plans,
  public.card_emi_installments,
  public.notifications
  to authenticated;
