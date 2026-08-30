import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, User } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

type Client = ReturnType<typeof createClient>;

/** Lifetime of a token minted for a scheduled run. */
const MINTED_TOKEN_SECONDS = 300;

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
  private readonly jwtSecret?: string;
  private readonly serviceRoleKey?: string;
  private readonly authClient: Client;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('SUPABASE_URL');
    this.anonKey = config.getOrThrow<string>('SUPABASE_ANON_KEY');
    // Only the scheduled job needs these, so a dev environment without them
    // still boots and serves every request-scoped route.
    this.jwtSecret = config.get<string>('SUPABASE_JWT_SECRET');
    this.serviceRoleKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
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

  clientForToken(token: string): Client {
    return createClient(this.url, this.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /**
   * A client acting as `userId`, for scheduled work that has no request and
   * so no JWT of its own. The token is minted with the project's JWT secret
   * and lives five minutes, so RLS scopes the run exactly as it would in the
   * app — a scheduled job gets no more reach than the user it runs for.
   *
   * Needs SUPABASE_JWT_SECRET, and the project's legacy HS256 secret must
   * still be active.
   */
  clientForUser(userId: string): Client {
    if (!this.jwtSecret) {
      throw new ServiceUnavailableException(
        'SUPABASE_JWT_SECRET is not set, so a scheduled run cannot act as a user.',
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      {
        sub: userId,
        role: 'authenticated',
        aud: 'authenticated',
        iss: `${this.url}/auth/v1`,
        iat: now,
        exp: now + MINTED_TOKEN_SECONDS,
      },
      this.jwtSecret,
      { algorithm: 'HS256' },
    );
    return this.clientForToken(token);
  }

  /**
   * Service-role client. Deliberately narrow in use: the scheduled job needs
   * the list of user ids that own a credit card before it can act as each of
   * them, and that list cannot be read under RLS. Everything the job then
   * does runs through `clientForUser`, never through this.
   */
  adminClient(): Client {
    if (!this.serviceRoleKey) {
      throw new ServiceUnavailableException(
        'SUPABASE_SERVICE_ROLE_KEY is not set, so the scheduled run cannot list the users to run for.',
      );
    }
    return createClient(this.url, this.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
}
