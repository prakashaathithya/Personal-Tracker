import { HttpException, HttpStatus } from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';

interface PostgrestResult<T> {
  data: T | null;
  error: PostgrestError | null;
}

/**
 * Awaits a Supabase query and normalizes the result:
 * - returns `data` on success
 * - throws an appropriate HttpException on error
 *
 * Maps common Postgres/PostgREST error codes to sensible HTTP statuses.
 */
export async function handle<T>(
  query: PromiseLike<PostgrestResult<T>>,
): Promise<T> {
  const { data, error } = await query;

  if (error) {
    const status = mapStatus(error.code);
    throw new HttpException(
      { message: error.message, code: error.code, details: error.details },
      status,
    );
  }

  return data as T;
}

function mapStatus(code: string | undefined): HttpStatus {
  switch (code) {
    case '23505': // unique_violation
      return HttpStatus.CONFLICT;
    case '23503': // foreign_key_violation
    case '23514': // check_violation
    case '22P02': // invalid_text_representation
      return HttpStatus.BAD_REQUEST;
    case '42501': // insufficient_privilege (RLS denied)
      return HttpStatus.FORBIDDEN;
    case 'PGRST116': // no rows returned for .single()
      return HttpStatus.NOT_FOUND;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
