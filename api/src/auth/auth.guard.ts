import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

/** Express request augmented by the guard with the authenticated context. */
export interface AuthedRequest extends Request {
  user: User;
  supabase: SupabaseClient;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'];
    const token =
      header && header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const user = await this.supabase.getUser(token);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    req.user = user;
    req.supabase = this.supabase.clientForToken(token);
    return true;
  }
}
