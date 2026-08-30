import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { Express } from 'express';
import helmet from 'helmet';

/**
 * Shared application setup used by both the local dev entry (main.ts)
 * and the Vercel serverless handler (../index.ts), so behaviour is identical
 * in both environments.
 */
export function configureApp(app: INestApplication): void {
  // All routes are served under /api so they map cleanly to Vercel functions.
  app.setGlobalPrefix('api');

  // Vercel terminates TLS and forwards the caller's address in
  // x-forwarded-for. Without this every request looks like it came from the
  // proxy, which would put all users in a single rate-limit bucket.
  const express = app.getHttpAdapter().getInstance() as Express;
  express.set('trust proxy', 1);

  // Security headers. The API only ever answers JSON, so the browser is told
  // not to sniff, frame or cache it; the Angular app is served by Vercel's
  // static layer and is unaffected by these.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { 'default-src': ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  // Strip unknown properties and coerce DTO types automatically.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Allow the Angular frontend (configured via CORS_ORIGIN) to call the API.
  // Comma-separated list of allowed origins; defaults to all in development.
  const origins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim());
  app.enableCors({
    origin: origins && origins.length ? origins : true,
    credentials: true,
  });
}
