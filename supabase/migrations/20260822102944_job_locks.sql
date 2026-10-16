-- Short-lived leases so a background catch-up runs once at a time.
--
-- Credit-card statement generation is triggered from the client on app load,
-- so two open tabs (or a tab plus a scheduled run) can start it at the same
-- moment. The unique constraints on card_statements make a duplicate bill
-- impossible, but the losing run still dies partway with a 409. A lease keeps
-- the second caller from starting at all.
--
-- The lease expires on its own, so a process that dies mid-run never wedges
-- the job permanently.

create table public.job_locks (
  key          text primary key,
  user_id      uuid references auth.users (id) on delete cascade,
  locked_at    timestamptz not null default now(),
  locked_until timestamptz not null
);

-- RLS on with no policies: the table is unreachable through PostgREST and can
-- only be touched by the security-definer functions below.
alter table public.job_locks enable row level security;

/**
 * Takes the lease for `p_job` on behalf of the calling user, returning false
 * when someone else already holds an unexpired one.
 *
 * The key is built from auth.uid() here rather than passed in, so a caller
 * cannot acquire or hold another user's lock.
 */
create or replace function public.try_acquire_job_lock(
  p_job text,
  p_ttl_seconds int default 60
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_key  text;
  v_got  boolean;
begin
  if v_user is null then
    raise exception 'try_acquire_job_lock requires an authenticated caller';
  end if;
  if p_ttl_seconds < 1 or p_ttl_seconds > 900 then
    raise exception 'ttl must be between 1 and 900 seconds';
  end if;

  v_key := p_job || ':' || v_user::text;

  -- The WHERE on the conflict branch is what makes this a lease: the update
  -- (and so the RETURNING) only happens when the existing lock has expired.
  insert into public.job_locks (key, user_id, locked_at, locked_until)
  values (v_key, v_user, now(), now() + make_interval(secs => p_ttl_seconds))
  on conflict (key) do update
    set locked_at    = now(),
        locked_until = now() + make_interval(secs => p_ttl_seconds),
        user_id      = v_user
    where public.job_locks.locked_until < now()
  returning true into v_got;

  return coalesce(v_got, false);
end;
$$;

/** Releases the caller's lease early, so the next run doesn't wait out the TTL. */
create or replace function public.release_job_lock(p_job text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;
  update public.job_locks
     set locked_until = now() - interval '1 second'
   where key = p_job || ':' || v_user::text;
end;
$$;

-- Signed-in users only; both functions force the caller to their own uid.
revoke execute on function public.try_acquire_job_lock(text, int) from anon, public;
revoke execute on function public.release_job_lock(text) from anon, public;
grant execute on function public.try_acquire_job_lock(text, int) to authenticated;
grant execute on function public.release_job_lock(text) to authenticated;
