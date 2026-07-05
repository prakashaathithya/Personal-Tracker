import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthedRequest } from './auth.guard';

/** Injects the authenticated Supabase user. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    return ctx.switchToHttp().getRequest<AuthedRequest>().user;
  },
);

/**
 * Injects an RLS-scoped Supabase client bound to the caller's JWT.
 * All queries through it are automatically restricted to the user's rows.
 */
export const Db = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SupabaseClient => {
    return ctx.switchToHttp().getRequest<AuthedRequest>().supabase;
  },
);
