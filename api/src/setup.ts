import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Shared application setup used by both the local dev entry (main.ts)
 * and the Vercel serverless handler (../index.ts), so behaviour is identical
 * in both environments.
 */
export function configureApp(app: INestApplication): void {
  // All routes are served under /api so they map cleanly to Vercel functions.
  app.setGlobalPrefix('api');

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
