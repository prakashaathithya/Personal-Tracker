-- Enable RLS everywhere
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.payment_types   enable row level security;
alter table public.transactions    enable row level security;
alter table public.budget_items    enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.loans           enable row level security;
alter table public.loan_schedule   enable row level security;

-- profiles: a user can see/update only their own profile
create policy "own profile - select" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile - update" on public.profiles
  for update using (auth.uid() = id);

-- Helper macro pattern: full CRUD scoped to auth.uid() = user_id
-- categories
create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- payment_types
create policy "own payment_types" on public.payment_types
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- transactions
create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- budget_items
create policy "own budget_items" on public.budget_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- monthly_budgets
create policy "own monthly_budgets" on public.monthly_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- loans
create policy "own loans" on public.loans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- loan_schedule: scoped through the parent loan's owner
create policy "own loan_schedule" on public.loan_schedule
  for all
  using (exists (select 1 from public.loans l where l.id = loan_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.loans l where l.id = loan_id and l.user_id = auth.uid()));
