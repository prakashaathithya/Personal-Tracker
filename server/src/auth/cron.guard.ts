import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

/**
 * Lets Vercel's scheduler through and nobody else.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on every cron invocation
 * once that variable is set on the project. With no secret configured the
 * route reports itself as missing rather than running unauthenticated — an
 * open catch-up endpoint would let anyone drive work for every account.
 */
@Injectable()
export class CronGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret) {
      throw new NotFoundException();
    }

    const header = context.switchToHttp().getRequest<Request>().headers[
      'authorization'
    ];
    const token =
      header && header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token || !equals(token, secret)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}

/** Compares without leaking how much of the secret matched. */
function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
