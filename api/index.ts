import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';
import { AppModule } from '../server/src/app.module';
import { configureApp } from '../server/src/setup';

/**
 * Vercel serverless entry point — the ONLY file in /api, so Vercel creates a
 * single function for it. The NestJS app lives in /server and is imported here.
 *
 * The full Nest application is bootstrapped once per cold start onto an Express
 * instance and reused across warm invocations. The `/api/(.*)` rewrite in
 * vercel.json routes every API request to this function.
 */
const server = express();
let ready: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  configureApp(app);
  await app.init();
}

export default async function handler(req: Request, res: Response) {
  if (!ready) {
    ready = bootstrap();
  }
  await ready;
  server(req, res);
}
