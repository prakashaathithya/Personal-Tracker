create extension if not exists pg_cron;

-- Run every day at 01:00 UTC for all users. Unschedule first if it exists so
-- this migration is idempotent.
do $$
begin
  perform cron.unschedule('run-due-recurring');
exception when others then
  null;
end;
$$;

select cron.schedule('run-due-recurring', '0 1 * * *', $$select public.run_due_recurring(null)$$);
