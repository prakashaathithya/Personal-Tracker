# Database migrations

Every schema change to the Supabase project (`wqvqrlpbeuuskzdrwmhl`) lives here as a
timestamped SQL file. Filenames are `<version>_<name>.sql`, and the version is the
value recorded in Supabase's own `supabase_migrations.schema_migrations` table.

## Applying a migration

There is no Supabase CLI or service-role key on the dev machine, so migrations are
applied by pasting the file into the Supabase SQL editor. After running it, record
the version so the dashboard's migration history stays in sync with this directory:

```sql
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20260812000000', 'credit_cards', array[$mig$<the full file contents>$mig$]);
```

## Order

Files apply in filename order. On an empty project, running all of them in that order
reproduces the full schema: types, tables, indexes, RLS policies, the `handle_new_user`
signup trigger, `run_due_recurring` plus its pg_cron schedule, the private `receipts`
storage bucket, and credit-card billing.

| Version | What it does |
| --- | --- |
| 20260614152032 | Core schema: `need_class` type, profiles, categories, payment_types, transactions, budget_items, monthly_budgets, loans, loan_schedule |
| 20260614152057 | Enables RLS and adds the owner policies for those tables |
| 20260614152242 | `handle_new_user()` signup seed (profile, default payment types, default categories) + `on_auth_user_created` trigger |
| 20260614152404 | Revokes public EXECUTE on `handle_new_user()` |
| 20260712154428 | Pins all money columns to `numeric(14,2)` / rates to `numeric(6,3)` |
| 20260712154441 | `accounts` table, `account_type` and `txn_direction` types, transaction `direction` / `account_id` / `transfer_account_id` |
| 20260712154508 | Data backfill: default Cash account per user, salaries moved from `monthly_budgets` to income transactions |
| 20260712154531 | Signup seed also creates the default Cash account and a `Salary` category |
| 20260712160203 | `categorization_rules`, `recurring_transactions`, and the `run_due_recurring()` function |
| 20260712160219 | pg_cron job `run-due-recurring`, daily at 01:00 UTC |
| 20260712160253 | Restricts EXECUTE on `run_due_recurring()` to `authenticated` |
| 20260712160920 | `savings_goals`, transaction `receipt_path`, private `receipts` storage bucket + its object policies |
| 20260812000000 | Credit cards: `credit_cards`, `card_statements`, `card_emi_plans`, `card_emi_installments`, `notifications` |

## Provenance

Versions `20260614152032` through `20260712160920` were recovered from the project's
`supabase_migrations.schema_migrations` table on 2026-08-22 — they had been applied
before this directory existed. They are verbatim copies of what ran against the
database, so the files and the live schema match (verified: no function, policy, or
table exists in `public` that these files do not create).

`20260812000000_credit_cards.sql` was authored here and applied through the SQL editor,
but it was never recorded in `supabase_migrations.schema_migrations`. Run the insert
above with that file's contents to close the gap.
