import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';
import { AppModule } from './src/app.module';
import { configureApp } from './src/setup';

/**
 * Vercel serverless entry point.
 *
 * Vercel turns this file into a single serverless function. We bootstrap the
 * full Nest application once per cold start onto an Express instance and reuse
 * it across invocations (warm starts). The `/api/(.*)` rewrite in vercel.json
 * routes every API request here.
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
