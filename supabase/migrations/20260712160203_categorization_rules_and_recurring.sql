-- Auto-categorization rules: match a description pattern to a category.
create type public.match_type as enum ('contains', 'equals', 'regex');

create table public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  match public.match_type not null default 'contains',
  pattern text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  priority int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.categorization_rules enable row level security;
create policy "own categorization_rules" on public.categorization_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index categorization_rules_user_idx on public.categorization_rules (user_id);

-- Recurring transaction templates that get materialized on a schedule.
create type public.recur_frequency as enum ('daily', 'weekly', 'monthly', 'yearly');

create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  direction public.txn_direction not null default 'expense',
  category_id uuid references public.categories (id) on delete set null,
  payment_type_id uuid references public.payment_types (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  transfer_account_id uuid references public.accounts (id) on delete set null,
  frequency public.recur_frequency not null default 'monthly',
  interval_count int not null default 1 check (interval_count >= 1),
  next_run date not null,
  end_date date,
  is_active boolean not null default true,
  last_generated date,
  created_at timestamptz not null default now()
);
alter table public.recurring_transactions enable row level security;
create policy "own recurring_transactions" on public.recurring_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index recurring_transactions_user_idx on public.recurring_transactions (user_id);

-- Materialize every due occurrence (next_run <= today) into transactions,
-- advancing next_run past today. Authenticated callers are always scoped to
-- their own rows; a null-uid caller (e.g. pg_cron) may pass a user or run all.
create or replace function public.run_due_recurring(p_user uuid default null)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  d date;
  n int := 0;
begin
  if auth.uid() is not null then
    p_user := auth.uid();
  end if;

  for r in
    select * from public.recurring_transactions
    where is_active
      and next_run <= current_date
      and (p_user is null or user_id = p_user)
  loop
    d := r.next_run;
    while d <= current_date and (r.end_date is null or d <= r.end_date) loop
      insert into public.transactions (
        user_id, txn_date, description, amount, direction,
        category_id, payment_type_id, account_id, transfer_account_id, planned
      ) values (
        r.user_id, d, r.description, r.amount, r.direction,
        r.category_id, r.payment_type_id, r.account_id, r.transfer_account_id, true
      );
      n := n + 1;
      d := case r.frequency
             when 'daily'   then d + r.interval_count
             when 'weekly'  then d + (r.interval_count * 7)
             when 'monthly' then (d + (r.interval_count || ' months')::interval)::date
             when 'yearly'  then (d + (r.interval_count || ' years')::interval)::date
           end;
    end loop;

    update public.recurring_transactions
    set next_run = d,
        last_generated = current_date,
        is_active = case when end_date is not null and d > end_date then false else is_active end
    where id = r.id;
  end loop;

  return n;
end;
$$;
