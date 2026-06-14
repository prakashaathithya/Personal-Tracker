import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/**
 * Single shared Supabase browser client. Used for authentication only;
 * all data access goes through the NestJS API (which enforces RLS).
 */
export const supabase: SupabaseClient = createClient(
  environment.supabaseUrl,
  environment.supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
