-- 1. Give every existing user a default "Cash" account.
insert into public.accounts (user_id, name, type)
select u.id, 'Cash', 'cash'
from auth.users u
where not exists (select 1 from public.accounts a where a.user_id = u.id);

-- 2. Assign all pre-existing transactions to each user's default account.
update public.transactions t
set account_id = (
  select a.id from public.accounts a
  where a.user_id = t.user_id
  order by a.created_at, a.id
  limit 1
)
where t.account_id is null;

-- 3. Ensure a "Salary" category exists for users who recorded a monthly salary.
insert into public.categories (user_id, name, need_class)
select distinct mb.user_id, 'Salary', 'Others'::public.need_class
from public.monthly_budgets mb
where mb.salary > 0
  and not exists (
    select 1 from public.categories c
    where c.user_id = mb.user_id and c.name = 'Salary'
  );

-- 4. Migrate each monthly salary into an income transaction.
insert into public.transactions
  (user_id, txn_date, description, amount, direction, category_id, account_id, planned)
select
  mb.user_id,
  mb.month,
  'Salary',
  mb.salary,
  'income'::public.txn_direction,
  (select c.id from public.categories c
     where c.user_id = mb.user_id and c.name = 'Salary' limit 1),
  (select a.id from public.accounts a
     where a.user_id = mb.user_id order by a.created_at, a.id limit 1),
  false
from public.monthly_budgets mb
where mb.salary > 0;

-- 5. Clear the legacy salary store so it is not double-counted.
delete from public.monthly_budgets;
