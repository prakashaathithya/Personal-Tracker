-- Only signed-in users may trigger a catch-up (the function forces them to
-- their own auth.uid()). anon has no uid, so must not be able to call it.
-- pg_cron runs as the function owner and is unaffected by these grants.
revoke execute on function public.run_due_recurring(uuid) from anon, public;
grant execute on function public.run_due_recurring(uuid) to authenticated;
