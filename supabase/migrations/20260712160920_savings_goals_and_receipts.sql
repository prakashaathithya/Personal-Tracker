-- Savings goals. A goal may track a specific account's balance, or a manually
-- maintained amount when no account is linked.
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount >= 0),
  current_amount numeric(14,2) not null default 0,
  account_id uuid references public.accounts (id) on delete set null,
  target_date date,
  created_at timestamptz not null default now()
);
alter table public.savings_goals enable row level security;
create policy "own savings_goals" on public.savings_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index savings_goals_user_idx on public.savings_goals (user_id);

-- Receipt image/PDF path (in the 'receipts' storage bucket) per transaction.
alter table public.transactions add column receipt_path text;

-- Private storage bucket for receipts.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Users can only touch objects under a top-level folder named after their uid.
create policy "own receipts read" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own receipts insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own receipts update" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own receipts delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
