import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Centralizes access to Supabase.
 *
 * - `getUser` verifies a JWT coming from the Angular frontend.
 * - `clientForToken` returns a Supabase client whose requests carry the user's
 *   JWT, so Postgres Row-Level Security automatically scopes every query to
 *   that user. The API never uses the service-role key for user data, which
 *   means a bug in our query logic still can't leak another user's rows.
 */
@Injectable()
export class SupabaseService {
  private readonly url: string;
  private readonly anonKey: string;
  private readonly authClient: SupabaseClient;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('SUPABASE_URL');
    this.anonKey = config.getOrThrow<string>('SUPABASE_ANON_KEY');
    this.authClient = createClient(this.url, this.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async getUser(token: string): Promise<User | null> {
    const { data, error } = await this.authClient.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }
    return data.user;
  }

  clientForToken(token: string): SupabaseClient {
    return createClient(this.url, this.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
}
