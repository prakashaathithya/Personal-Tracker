-- The trigger runs as the table owner regardless of caller, so no role
-- needs direct EXECUTE. Revoke it to remove the function from the public API.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
