import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { supabase } from './supabase.client';

/** Allows navigation only when a Supabase session exists; else redirects to /login. */
export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const { data } = await supabase.auth.getSession();
  return data.session ? true : router.createUrlTree(['/login']);
};

/** Keeps authenticated users away from /login and /signup. */
export const guestGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const { data } = await supabase.auth.getSession();
  return data.session ? router.createUrlTree(['/dashboard']) : true;
};
