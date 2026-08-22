-- Money columns were unbounded numeric; pin them to 2-decimal scale so no
-- sub-cent drift can ever be stored. Existing values already fit these types.
alter table public.transactions   alter column amount type numeric(14,2);
alter table public.budget_items    alter column amount type numeric(14,2);
alter table public.monthly_budgets alter column salary type numeric(14,2);

alter table public.loans
  alter column principal   type numeric(14,2),
  alter column annual_rate type numeric(6,3),
  alter column emi_amount  type numeric(14,2);

alter table public.loan_schedule
  alter column emi            type numeric(14,2),
  alter column interest       type numeric(14,2),
  alter column principal_paid type numeric(14,2),
  alter column balance        type numeric(14,2);
