import { Injectable, signal } from '@angular/core';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Current session, kept in sync with Supabase auth state. */
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly initialized = signal(false);

  constructor() {
    void supabase.auth.getSession().then(({ data }) => {
      this.setSession(data.session);
      this.initialized.set(true);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      this.setSession(session);
    });
  }

  private setSession(session: Session | null) {
    this.session.set(session);
    this.user.set(session?.user ?? null);
  }

  get accessToken(): string | null {
    return this.session()?.access_token ?? null;
  }

  isAuthenticated(): boolean {
    return !!this.session();
  }

  async signUp(email: string, password: string, fullName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: fullName ? { full_name: fullName } : undefined },
    });
    if (error) throw error;
    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async signOut() {
    await supabase.auth.signOut();
  }
}
